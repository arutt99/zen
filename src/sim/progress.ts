// Pure functions that derive progress from the facts plus the data (plan 9.2, 9.3). No state here.
import { BUILDINGS, buildingCost, type BuildingDef, type BuildingId } from '../data/buildings';
import { MATERIALS, type MaterialId } from '../data/gathering';
import type { PlaceDef } from '../data/places';
import { clamp } from '../core/util';
import { ANIMALS, type AnimalDef } from '../data/animals';
import type { Bag } from './state';

/** Counts per material where a missing material means none (older tests and saves name only some). */
export type Counts = Partial<Bag>;
const n = (c: Counts | undefined, m: MaterialId) => c?.[m] ?? 0;

/** Which of the building's parts are in place. A part of material m is built once m's count reaches it. */
export function partsBuilt(b: BuildingDef, delivered: Counts): boolean[] {
  const seen: Record<MaterialId, number> = { wood: 0, stone: 0, bamboo: 0 };
  return b.parts.map((p) => seen[p.material]++ < n(delivered, p.material));
}

export function partsBuiltCount(b: BuildingDef, delivered: Counts): number {
  return partsBuilt(b, delivered).filter(Boolean).length;
}

export function isComplete(b: BuildingDef, delivered: Counts): boolean {
  return partsBuiltCount(b, delivered) === b.parts.length;
}

/** Units of each material still needed. */
export function remaining(b: BuildingDef, delivered: Counts): Bag {
  const cost = buildingCost(b);
  const out: Bag = { wood: 0, stone: 0, bamboo: 0 };
  for (const m of MATERIALS) out[m] = Math.max(0, (cost[m] ?? 0) - n(delivered, m));
  return out;
}

/** The material to deposit next: the earliest unbuilt part the satchel can pay for, or null. */
export function nextDeposit(b: BuildingDef, delivered: Counts, satchel: Counts): MaterialId | null {
  const built = partsBuilt(b, delivered);
  for (let i = 0; i < b.parts.length; i++) {
    const m = b.parts[i]!.material;
    if (!built[i] && n(satchel, m) > 0) return m;
  }
  return null;
}

/** The buildings complete at a place. */
export function completedBuildings(place: PlaceDef, deposits: Record<string, Counts>): Set<BuildingId> {
  const done = new Set<BuildingId>();
  for (const s of place.sites) {
    const b = BUILDINGS[s.building];
    const d = deposits[s.id];
    if (b && d && isComplete(b, d)) done.add(b.id);
  }
  return done;
}

/**
 * Every building complete anywhere (Phase 4: a site can wait on a building in another place, as the tea
 * house at home waits for the grove's wind shrine). `siteBuilding` maps site id → building id.
 */
export function completedAll(siteBuilding: Readonly<Record<string, BuildingId>>, deposits: Record<string, Counts>): Set<BuildingId> {
  const done = new Set<BuildingId>();
  for (const [site, id] of Object.entries(siteBuilding)) {
    const d = deposits[site];
    if (d && isComplete(BUILDINGS[id], d)) done.add(id);
  }
  return done;
}

/** True when an exit can be walked (plan 4.1): no gate, or its building is complete. */
export function exitOpen(exit: { requires?: BuildingId }, done: ReadonlySet<BuildingId>): boolean {
  return !exit.requires || done.has(exit.requires);
}

/** The travel map (plan 4.1) unlocks once a second place has been found: after the first visit. */
export function mapUnlocked(discovered: ReadonlySet<string>): boolean {
  return discovered.size > 1;
}

/**
 * True when a building's site has revealed itself: every building it requires is complete (plan 3.3,
 * "then the next site gently reveals itself"). A site that already has deposits stays open regardless,
 * so a repaired or odd save never hides work already done.
 */
export function siteOpen(b: BuildingDef, done: ReadonlySet<BuildingId>, delivered?: Counts): boolean {
  if (delivered && MATERIALS.some((m) => n(delivered, m) > 0)) return true;
  return b.requires.every((r) => done.has(r));
}

/** True when something gated on a building (a sit spot, a note) is there: no gate, or the building is done. */
export function unlocked(requires: BuildingId | undefined, done: ReadonlySet<BuildingId>): boolean {
  return !requires || done.has(requires);
}

/**
 * Restoration props (plan 3.4): 1 when shown at this level, 0 when not. Overgrowth (`max`) is gone once
 * the level reaches it; new growth (`min`) is there once the level reaches it.
 */
export function growthShown(g: { min?: number; max?: number; requires?: BuildingId }, level: number, done?: ReadonlySet<BuildingId>): number {
  const eps = 1e-6;
  if (g.requires && !done?.has(g.requires)) return 0;
  if (g.min !== undefined && level < g.min - eps) return 0;
  if (g.max !== undefined && level >= g.max - eps) return 0;
  return 1;
}

/** How murky the pond is, 0 (clear) .. place.water.murk, falling as restoration rises (plan 3.4). */
export function waterMurk(place: PlaceDef, level: number): number {
  return place.water.murk * (1 - clamp(level / Math.max(1e-6, place.water.clearAt)));
}

/** A place's restoration level, 0..1: the sum of its completed buildings' contributions. */
export function restoration(place: PlaceDef, deposits: Record<string, Counts>): number {
  let r = 0;
  for (const id of completedBuildings(place, deposits)) r += BUILDINGS[id].restoration;
  return clamp(r);
}

/** How much mist hangs over the place, 1 (full) to 0 (lifted). */
export function mistAmount(place: PlaceDef, level: number): number {
  return 1 - clamp(level / Math.max(1e-6, place.mist.clearAt));
}

/** Animal friends present at a place: those whose arrival level its restoration has reached (plan 4.3). */
export function animalsPresent(place: PlaceDef, deposits: Record<string, Counts>): AnimalDef[] {
  const level = restoration(place, deposits);
  return Object.values(ANIMALS).filter((a) => a.place === place.id && level >= a.minRestoration - 1e-9);
}
