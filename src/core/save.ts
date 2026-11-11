// Versioned save in localStorage. Stores facts only (plan 9.2); everything else is derived on load.
// Corrupt or unknown data falls back to a fresh save instead of crashing.

import type { QualityTier } from '../data/quality';
import { BUILDINGS, unitsForOldParts, type BuildingId } from '../data/buildings';
import { MATERIALS } from '../data/gathering';

export const SAVE_VERSION = 6;
export const SAVE_KEY = 'moss-and-bell/save';

export interface SaveSettings {
  quality: QualityTier | 'auto';
  sound: boolean;
  /** Art decision points A2 and A3 (decided; src/data/feel.ts). Kept so older saves load. */
  camera: string;
  scale: string;
  /** Phase 2 trial options: look preset (A6), character style (A4), building kit style (A5). */
  look: string;
  character: string;
  kit: string;
  /**
   * Time of day (plan 5): the device clock, always day, or a chosen moment (the slider), 0..1 of the day.
   */
  time: { mode: 'clock' | 'day' | 'fixed'; at: number };
}

/** Counts of each material, by material id. */
export type Counts = Record<string, number>;

export interface SaveData {
  v: typeof SAVE_VERSION;
  at: { place: string; x: number; z: number };
  /** What the caretaker carries. */
  satchel: Counts;
  /** Units delivered per build site id. Growth is derived from this (parts shown = units delivered). */
  deposits: Record<string, Counts>;
  /** Words found (poem stones, caretaker notes), by id. Phase 5's collection book reads this. */
  collection: string[];
  /** Places reached so far (Phase 4, plan 9.5's `places`): the travel map is derived from it. */
  places: string[];
  /** True once the opening (plan 4.5) has been shown, so it never plays again. */
  opened: boolean;
  settings: SaveSettings;
}

/** The minimal storage surface we need, so tests can pass an in-memory fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function freshSave(): SaveData {
  // An empty place means "no position saved yet": the game starts at the place's spawn point.
  return {
    v: SAVE_VERSION,
    at: { place: '', x: 0, z: 0 },
    satchel: {},
    deposits: {},
    collection: [],
    places: [],
    opened: false,
    settings: { quality: 'auto', sound: true, camera: 'a', scale: 'm', look: 'lanternfallplus', character: 'chibi', kit: 'timber', time: { mode: 'clock', at: 0.5 } },
  };
}

/** One entry per old version: migrations[n] upgrades a version-n object to version n+1. */
const migrations: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 (Phase 0) had only position and settings: start with an empty satchel and no deposits.
  1: (old) => ({ ...old, v: 2, satchel: {}, deposits: {} }),
  // v2 (Phase 1) had no look, character, kit or time settings: field repair below fills the defaults.
  2: (old) => ({ ...old, v: 3 }),
  // v3 (Phase 2) had no collection. A player who had already started has seen the opening.
  3: (old) => ({ ...old, v: 4, collection: [], opened: true }),
  // v4 (Phase 3) had only the home valley: anyone who had started had reached it.
  4: (old) => ({ ...old, v: 5, places: old.opened === true ? ['home_valley'] : [] }),
  // v5 (Phase 4) counted one unit per part. The pacing pass cut parts into pieces: what was built stays
  // built (and whole), so each old count becomes the units of the parts it had built.
  5: (old) => {
    const deposits: Record<string, Counts> = {};
    for (const [site, c] of Object.entries(isObj(old.deposits) ? old.deposits : {})) {
      const b = BUILDINGS[site as BuildingId];
      const was = counts(c);
      if (!b) { deposits[site] = was; continue; }
      const now: Counts = {};
      for (const m of MATERIALS) if (was[m]) now[m] = unitsForOldParts(b, m, was[m]);
      deposits[site] = now;
    }
    return { ...old, v: 6, deposits };
  },
};

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isObj = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null && !Array.isArray(o);
const ID = /^[a-z0-9_]{1,40}$/;

/** Keeps only id → non-negative whole number entries. Ranges against the data are checked by sim/state. */
function counts(o: unknown): Counts {
  const out: Counts = {};
  if (!isObj(o)) return out;
  for (const [k, v] of Object.entries(o)) if (ID.test(k) && isNum(v) && v > 0) out[k] = Math.floor(v);
  return out;
}

function timeSetting(o: unknown, fallback: SaveSettings['time']): SaveSettings['time'] {
  if (!isObj(o)) return { ...fallback };
  const mode = o.mode === 'fixed' || o.mode === 'clock' || o.mode === 'day' ? o.mode : fallback.mode;
  const at = isNum(o.at) ? ((o.at % 1) + 1) % 1 : fallback.at;
  return { mode, at };
}

/** Parse and validate raw text. Returns a fresh save (and a reason) for anything unusable. */
export function parseSave(raw: string | null): { data: SaveData; recovered: string | null } {
  if (raw == null) return { data: freshSave(), recovered: null };
  let obj: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    obj = parsed as Record<string, unknown>;
  } catch {
    return { data: freshSave(), recovered: 'corrupt save (not JSON)' };
  }
  const rawV = obj.v;
  if (!isNum(rawV) || rawV < 1 || rawV > SAVE_VERSION) return { data: freshSave(), recovered: `unknown save version ${String(rawV)}` };
  let v: number = rawV;
  while (v < SAVE_VERSION) {
    const m = migrations[v];
    if (!m) return { data: freshSave(), recovered: `no migration from version ${v}` };
    obj = m(obj);
    v = v + 1;
  }
  const base = freshSave();
  const at = obj.at as Record<string, unknown> | undefined;
  const settings = obj.settings as Record<string, unknown> | undefined;
  const quality = settings?.quality;
  return {
    data: {
      v: SAVE_VERSION,
      at: {
        place: typeof at?.place === 'string' ? at.place : base.at.place,
        x: isNum(at?.x) ? at.x : base.at.x,
        z: isNum(at?.z) ? at.z : base.at.z,
      },
      satchel: counts(obj.satchel),
      deposits: Object.fromEntries(
        Object.entries(isObj(obj.deposits) ? obj.deposits : {})
          .filter(([k]) => ID.test(k))
          .map(([k, v]) => [k, counts(v)] as const)
          .filter(([, c]) => Object.keys(c).length > 0),
      ),
      collection: Array.isArray(obj.collection) ? [...new Set(obj.collection.filter((x): x is string => typeof x === 'string' && ID.test(x)))].sort() : [],
      places: Array.isArray(obj.places) ? [...new Set(obj.places.filter((x): x is string => typeof x === 'string' && ID.test(x)))].sort() : [],
      opened: typeof obj.opened === 'boolean' ? obj.opened : base.opened,
      settings: {
        quality: quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'ultra' ? quality : 'auto',
        sound: typeof settings?.sound === 'boolean' ? settings.sound : base.settings.sound,
        camera: typeof settings?.camera === 'string' && ID.test(settings.camera) ? settings.camera : base.settings.camera,
        scale: typeof settings?.scale === 'string' && ID.test(settings.scale) ? settings.scale : base.settings.scale,
        look: typeof settings?.look === 'string' && ID.test(settings.look) ? settings.look : base.settings.look,
        character: typeof settings?.character === 'string' && ID.test(settings.character) ? settings.character : base.settings.character,
        kit: typeof settings?.kit === 'string' && ID.test(settings.kit) ? settings.kit : base.settings.kit,
        time: timeSetting(settings?.time, base.settings.time),
      },
    },
    recovered: null,
  };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}

export function loadSave(store: KeyValueStore | null): { data: SaveData; recovered: string | null } {
  if (!store) return { data: freshSave(), recovered: null };
  let raw: string | null = null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch {
    return { data: freshSave(), recovered: 'storage unavailable' };
  }
  return parseSave(raw);
}

export function writeSave(store: KeyValueStore | null, data: SaveData): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, serializeSave(data));
    return true;
  } catch {
    return false;
  }
}

/** localStorage if the browser allows it (private modes and sandboxed frames may throw). */
export function browserStore(): KeyValueStore | null {
  try {
    const s = globalThis.localStorage;
    const probe = '__mb_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
