// Pure functions that derive progress from the facts plus the data (plan 9.2, 9.3). No state here.
import { BUILDINGS, buildingCost, type BuildingDef, type BuildingId } from '../data/buildings';
import { MATERIALS, type MaterialId } from '../data/gathering';
import type { PlaceDef } from '../data/places';
import { clamp } from '../core/util';
import type { Bag } from './state';

/** Which of the building's parts are in place. A part of material m is built once m's count reaches it. */
export function partsBuilt(b: BuildingDef, delivered: Bag): boolean[] {
  const seen: Record<MaterialId, number> = { wood: 0, stone: 0 };
  return b.parts.map((p) => seen[p.material]++ < delivered[p.material]);
}

export function partsBuiltCount(b: BuildingDef, delivered: Bag): number {
  return partsBuilt(b, delivered).filter(Boolean).length;
}

export function isComplete(b: BuildingDef, delivered: Bag): boolean {
  return partsBuiltCount(b, delivered) === b.parts.length;
}

/** Units of each material still needed. */
export function remaining(b: BuildingDef, delivered: Bag): Bag {
  const cost = buildingCost(b);
  const out = { wood: 0, stone: 0 } as Bag;
  for (const m of MATERIALS) out[m] = Math.max(0, (cost[m] ?? 0) - delivered[m]);
  return out;
}

/** The material to deposit next: the earliest unbuilt part the satchel can pay for, or null. */
export function nextDeposit(b: BuildingDef, delivered: Bag, satchel: Bag): MaterialId | null {
  const built = partsBuilt(b, delivered);
  for (let i = 0; i < b.parts.length; i++) {
    const m = b.parts[i]!.material;
    if (!built[i] && satchel[m] > 0) return m;
  }
  return null;
}

/** A place's restoration level, 0..1: the sum of its completed buildings' contributions. */
export function restoration(place: PlaceDef, deposits: Record<string, Bag>): number {
  let r = 0;
  for (const s of place.sites) {
    const b = BUILDINGS[s.building as BuildingId];
    const d = deposits[s.id];
    if (b && d && isComplete(b, d)) r += b.restoration;
  }
  return clamp(r);
}

/** How much mist hangs over the place, 1 (full) to 0 (lifted). */
export function mistAmount(place: PlaceDef, level: number): number {
  return 1 - clamp(level / Math.max(1e-6, place.mist.clearAt));
}
