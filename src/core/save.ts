// Versioned save in localStorage. Stores facts only (plan 9.2); everything else is derived on load.
// Corrupt or unknown data falls back to a fresh save instead of crashing.

import type { QualityTier } from '../data/quality';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'moss-and-bell/save';

export interface SaveSettings {
  quality: QualityTier | 'auto';
  sound: boolean;
}

export interface SaveData {
  v: typeof SAVE_VERSION;
  at: { place: string; x: number; z: number };
  settings: SaveSettings;
}

/** The minimal storage surface we need, so tests can pass an in-memory fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function freshSave(): SaveData {
  return { v: SAVE_VERSION, at: { place: 'home_valley', x: 0, z: 6 }, settings: { quality: 'auto', sound: true } };
}

/** One entry per old version: migrations[n] upgrades a version-n object to version n+1. */
const migrations: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

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
      settings: {
        quality: quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'ultra' ? quality : 'auto',
        sound: typeof settings?.sound === 'boolean' ? settings.sound : base.settings.sound,
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
