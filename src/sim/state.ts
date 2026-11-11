// The game's facts (plan 9.3): what the satchel holds and what each site has been given. This is the
// only place facts change; every change emits an event. Everything else is derived (sim/progress.ts).
import { BUILDINGS, buildingCost, type BuildingId } from '../data/buildings';
import { MATERIALS, SATCHEL_CAP, type MaterialId } from '../data/gathering';
import type { PlaceDef } from '../data/places';
import { WORDS } from '../data/words';
import { FIND_IDS } from '../data/finds';
import { DECORATIONS, DECORATE } from '../data/decorations';
import { KIT_STYLES, type KitStyleId } from '../data/buildings';

/** A placed decoration (Phase 5): which one, where, and which way it faces. */
export interface Decoration { id: string; place: string; x: number; z: number; rot: number }

export type Bag = Record<MaterialId, number>;
export const emptyBag = (): Bag => ({ wood: 0, stone: 0, bamboo: 0 });

export type GameEvent =
  | { type: 'gathered'; node: string; material: MaterialId; /** 0 = the node's first unit. */ unit: number; left: number }
  | { type: 'deposited'; site: string; material: MaterialId; /** Index into the building's part list. */ part: number }
  | { type: 'completed'; site: string; building: BuildingId }
  /** A poem stone or note was read for the first time (it joins the collection). */
  | { type: 'collected'; id: string }
  /** A place was reached for the first time (Phase 4; the travel map unlocks with the second). */
  | { type: 'discovered'; place: string }
  /** Phase 5: a decoration placed or removed, a building restyled. */
  | { type: 'decorated'; index: number }
  | { type: 'undecorated'; decoration: Decoration }
  | { type: 'styled'; site: string; style: KitStyleId };

/** The facts as the save stores them. */
export interface Facts {
  satchel: Partial<Record<string, number>>;
  deposits: Partial<Record<string, Partial<Record<string, number>>>>;
  /** Ids of words found (poems, notes); unknown ids are dropped on load. */
  collection?: readonly string[];
  /** Places reached so far (Phase 4); unknown ids are dropped on load. */
  places?: readonly string[];
  /** Phase 5: decorations placed; unknown ids, places or anything over a place's limit are dropped. */
  decorations?: readonly Decoration[];
  /** Phase 5: building style per site; unknown sites or styles are dropped. */
  styles?: Readonly<Record<string, string>>;
}

const count = (n: unknown, max: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0);

export class GameState {
  satchel: Bag = emptyBag();
  /** Units delivered per site id. Never more than the building's cost. */
  deposits: Record<string, Bag> = {};
  /** Words found so far (plan 4.4: poems and notes join the collection book, Phase 5). */
  readonly collection = new Set<string>();
  /** Places reached so far (plan 4.1: walked the first time, then on the travel map). */
  readonly places = new Set<string>();
  /** Decorations placed, in the order they were placed (Phase 5). */
  readonly decorations: Decoration[] = [];
  /** Building style per site id, where it isn't the default (Phase 5, A5: timber by default). */
  readonly styles: Record<string, KitStyleId> = {};
  /** Which building each site holds, from the place data. */
  readonly siteBuilding: Record<string, BuildingId> = {};
  private listeners: ((e: GameEvent) => void)[] = [];

  private knownPlaces: Set<string>;

  constructor(places: readonly PlaceDef[], facts?: Facts, private knownWords: ReadonlySet<string> = new Set([...Object.keys(WORDS), ...FIND_IDS])) {
    this.knownPlaces = new Set(places.map((p) => p.id));
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
    for (const id of facts.collection ?? []) if (this.knownWords.has(id)) this.collection.add(id);
    for (const id of facts.places ?? []) if (this.knownPlaces.has(id)) this.places.add(id);
    for (const d of facts.decorations ?? []) this.addDecoration(d, false);
    for (const [site, st] of Object.entries(facts.styles ?? {})) this.setStyle(site, st, false);
  }

  /** How many decorations a place has, and how many it allows (0 = no decorating there). */
  decorationRoom(place: string): number {
    const max = DECORATE[place as keyof typeof DECORATE]?.max ?? 0;
    return max - this.decorations.filter((d) => d.place === place).length;
  }

  private addDecoration(d: Decoration, emit: boolean): boolean {
    if (!DECORATIONS[d.id] || !this.knownPlaces.has(d.place) || this.decorationRoom(d.place) <= 0) return false;
    if (!Number.isFinite(d.x) || !Number.isFinite(d.z) || !Number.isFinite(d.rot)) return false;
    this.decorations.push({ id: d.id, place: d.place, x: d.x, z: d.z, rot: d.rot });
    if (emit) this.emit({ type: 'decorated', index: this.decorations.length - 1 });
    return true;
  }

  /**
   * Places a decoration (a fact). Whether the spot is allowed is the caller's check (sim/decorate.ts); this
   * only refuses unknown ids or places and a full place.
   */
  decorate(d: Decoration): boolean {
    return this.addDecoration(d, true);
  }

  /** Removes the decoration at `index`. Nothing is given back: nothing was spent. */
  undecorate(index: number): boolean {
    const d = this.decorations[index];
    if (!d) return false;
    this.decorations.splice(index, 1);
    this.emit({ type: 'undecorated', decoration: d });
    return true;
  }

  /** The style a site is built in (timber unless chosen otherwise). */
  styleOf(site: string): KitStyleId {
    return this.styles[site] ?? 'timber';
  }

  /** Chooses a site's building style (free and changeable, plan 10 Phase 5). Returns true if it changed. */
  setStyle(site: string, style: string, emit = true): boolean {
    if (!this.siteBuilding[site] || !(KIT_STYLES as readonly string[]).includes(style)) return false;
    const st = style as KitStyleId;
    if (this.styleOf(site) === st) return false;
    if (st === 'timber') delete this.styles[site];
    else this.styles[site] = st;
    if (emit) this.emit({ type: 'styled', site, style: st });
    return true;
  }

  /** Records that a place was reached. Returns true the first time only. */
  discover(place: string): boolean {
    if (!this.knownPlaces.has(place) || this.places.has(place)) return false;
    this.places.add(place);
    this.emit({ type: 'discovered', place });
    return true;
  }

  /** Records that a word was read. Returns true the first time only. */
  collect(id: string): boolean {
    if (!this.knownWords.has(id) || this.collection.has(id)) return false;
    this.collection.add(id);
    this.emit({ type: 'collected', id });
    return true;
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
  toFacts(): { satchel: Bag; deposits: Record<string, Partial<Bag>>; collection: string[]; places: string[]; decorations: Decoration[]; styles: Record<string, KitStyleId> } {
    const deposits: Record<string, Partial<Bag>> = {};
    for (const [site, bag] of Object.entries(this.deposits)) {
      const out: Partial<Bag> = {};
      for (const m of MATERIALS) if (bag[m] > 0) out[m] = bag[m];
      if (Object.keys(out).length) deposits[site] = out;
    }
    return { satchel: { ...this.satchel }, deposits, collection: [...this.collection].sort(), places: [...this.places].sort(), decorations: this.decorations.map((d) => ({ ...d })), styles: { ...this.styles } };
  }
}
