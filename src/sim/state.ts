// The game's facts (plan 9.3): what the satchel holds and what each site has been given. This is the
// only place facts change; every change emits an event. Everything else is derived (sim/progress.ts).
import { BUILDINGS, buildingCost, type BuildingId } from '../data/buildings';
import { MATERIALS, SATCHEL_CAP, type MaterialId } from '../data/gathering';
import type { PlaceDef } from '../data/places';

export type Bag = Record<MaterialId, number>;
export const emptyBag = (): Bag => ({ wood: 0, stone: 0 });

export type GameEvent =
  | { type: 'gathered'; node: string; material: MaterialId; /** 0 = the node's first unit. */ unit: number; left: number }
  | { type: 'deposited'; site: string; material: MaterialId; /** Index into the building's part list. */ part: number }
  | { type: 'completed'; site: string; building: BuildingId };

/** The facts as the save stores them. */
export interface Facts {
  satchel: Partial<Record<string, number>>;
  deposits: Partial<Record<string, Partial<Record<string, number>>>>;
}

const count = (n: unknown, max: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0);

export class GameState {
  satchel: Bag = emptyBag();
  /** Units delivered per site id. Never more than the building's cost. */
  deposits: Record<string, Bag> = {};
  /** Which building each site holds, from the place data. */
  readonly siteBuilding: Record<string, BuildingId> = {};
  private listeners: ((e: GameEvent) => void)[] = [];

  constructor(places: readonly PlaceDef[], facts?: Facts) {
    for (const p of places) {
      for (const s of p.sites) {
        this.siteBuilding[s.id] = s.building;
        this.deposits[s.id] = emptyBag();
      }
    }
    if (!facts) return;
    // Load, repairing anything out of range: unknown sites are dropped, counts are clamped to the cost.
    for (const m of MATERIALS) this.satchel[m] = count(facts.satchel[m], SATCHEL_CAP);
    for (const [site, bag] of Object.entries(facts.deposits)) {
      const b = this.siteBuilding[site];
      if (!b || !bag) continue;
      const cost = buildingCost(BUILDINGS[b]);
      for (const m of MATERIALS) this.deposits[site]![m] = count(bag[m], cost[m] ?? 0);
    }
  }

  on(fn: (e: GameEvent) => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  }

  private emit(e: GameEvent) {
    for (const f of this.listeners) f(e);
  }

  /** Room left in the satchel for one material. */
  room(m: MaterialId): number {
    return SATCHEL_CAP - this.satchel[m];
  }

  /** Adds one gathered unit. Returns false (and changes nothing) when the satchel is full of it. */
  gather(node: string, m: MaterialId, unit: number, left: number): boolean {
    if (this.room(m) <= 0) return false;
    this.satchel[m]++;
    this.emit({ type: 'gathered', node, material: m, unit, left });
    return true;
  }

  /**
   * Moves one unit from the satchel into a site. Refuses anything the satchel lacks or the building
   * doesn't need, so a deposit can never exceed the cost.
   */
  deposit(site: string, m: MaterialId): boolean {
    const b = this.siteBuilding[site];
    if (!b || this.satchel[m] <= 0) return false;
    const def = BUILDINGS[b];
    const have = this.deposits[site]!;
    if (have[m] >= (buildingCost(def)[m] ?? 0)) return false;
    // The part this unit becomes: the next unbuilt part of this material, in build order.
    let seen = 0;
    const part = def.parts.findIndex((p) => p.material === m && seen++ === have[m]);
    this.satchel[m]--;
    have[m]++;
    this.emit({ type: 'deposited', site, material: m, part });
    if (def.parts.length === MATERIALS.reduce((s, k) => s + have[k], 0)) this.emit({ type: 'completed', site, building: b });
    return true;
  }

  /** The facts to save. Sites with nothing delivered are left out. */
  toFacts(): { satchel: Bag; deposits: Record<string, Partial<Bag>> } {
    const deposits: Record<string, Partial<Bag>> = {};
    for (const [site, bag] of Object.entries(this.deposits)) {
      const out: Partial<Bag> = {};
      for (const m of MATERIALS) if (bag[m] > 0) out[m] = bag[m];
      if (Object.keys(out).length) deposits[site] = out;
    }
    return { satchel: { ...this.satchel }, deposits };
  }
}
