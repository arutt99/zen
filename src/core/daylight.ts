// Time of day (plan 5): the clock and the blend of a place's presets along its day cycle.
// Pure, no three.js: tests and the renderer share it. The renderer reads `presetAt()` each frame.
import { DAY_CYCLES, PRESETS, type PlacePreset } from '../data/presets';
import { clamp } from './util';

/** How the time of day is chosen: the device's clock, or a fixed moment (the debug slider). */
export interface TimeSetting {
  mode: 'clock' | 'fixed';
  /** Fraction of the day, 0..1 (0 = midnight), used when mode is 'fixed'. */
  at: number;
}

/** Fraction of the local day for a Date: 0 at midnight, 0.5 at noon. */
export function dayFraction(d: Date): number {
  return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000) / 86400;
}

export function timeOfDay(setting: TimeSetting, now: Date): number {
  return setting.mode === 'fixed' ? ((setting.at % 1) + 1) % 1 : dayFraction(now);
}

/** "06:15" for a fraction of the day. */
export function clockLabel(t: number): string {
  const m = Math.round((((t % 1) + 1) % 1) * 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const isColorKey = (k: string) => /^(ground|rock|path|shore|peak$|water|zenith|horizon|low|cloud|sunColor|hemiSky|hemiGround|fog$|rim|rayColor)/.test(k);

function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number) => {
    const x = (a >> s) & 255, y = (b >> s) & 255;
    return Math.round(x + (y - x) * t) & 255;
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const mixNum = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [mixNum(a[0], b[0], t), mixNum(a[1], b[1], t), mixNum(a[2], b[2], t)];

/** Blends two presets. Colors mix per channel, numbers linearly; lists come from the nearer one. */
export function blendPresets(a: PlacePreset, b: PlacePreset, t: number): PlacePreset {
  const k = clamp(t);
  if (k === 0 || a === b) return a;
  if (k === 1) return b;
  const out = { ...(k < 0.5 ? a : b) } as unknown as Record<string, unknown>;
  const ra = a as unknown as Record<string, unknown>, rb = b as unknown as Record<string, unknown>;
  for (const key of Object.keys(a)) {
    const x = ra[key], y = rb[key];
    if (typeof x === 'number' && typeof y === 'number') out[key] = isColorKey(key) ? mixColor(x, y, k) : mixNum(x, y, k);
  }
  // The sun swings through the sky; normalizing the mix keeps it a direction.
  const sd = mix3(a.sunDir, b.sunDir, k);
  const l = Math.hypot(...sd) || 1;
  out.sunDir = [sd[0] / l, sd[1] / l, sd[2] / l];
  out.grade = { lift: mix3(a.grade.lift, b.grade.lift, k), gain: mix3(a.grade.gain, b.grade.gain, k), sat: mixNum(a.grade.sat, b.grade.sat, k) };
  out.id = k < 0.5 ? a.id : b.id;
  return out as unknown as PlacePreset;
}

/** The place's look at a fraction of the day. Neighbouring keys blend with an eased curve. */
export function presetAt(cycleId: string, t: number): PlacePreset {
  const keys = DAY_CYCLES[cycleId];
  if (!keys || keys.length === 0) return PRESETS.home_day!;
  const x = ((t % 1) + 1) % 1;
  for (let i = 0; i < keys.length; i++) {
    const [t0, p0] = keys[i]!;
    const [t1raw, p1] = keys[(i + 1) % keys.length]!;
    const t1 = i + 1 < keys.length ? t1raw : t1raw + 1; // the last key wraps past midnight
    const xx = x < keys[0]![0] && i === keys.length - 1 ? x + 1 : x;
    if (xx >= t0 && xx < t1) {
      const k = (xx - t0) / (t1 - t0);
      return withUnitSun(blendPresets(PRESETS[p0]!, PRESETS[p1]!, k * k * (3 - 2 * k)));
    }
  }
  return withUnitSun(PRESETS[keys[0]![1]]!);
}

function withUnitSun(p: PlacePreset): PlacePreset {
  const l = Math.hypot(...p.sunDir) || 1;
  return Math.abs(l - 1) < 1e-9 ? p : { ...p, sunDir: [p.sunDir[0] / l, p.sunDir[1] / l, p.sunDir[2] / l] };
}

/** Light reaching the ground, relative to a reference preset (plain day). */
function rawLight(p: PlacePreset): number {
  return p.sunI * 0.75 + p.hemiI * 0.8;
}

/**
 * Overall brightness for the painted shading (1 = full day). Night is dimmer but never dark
 * (plan 5: "Night is beautiful, not dark"), so the curve is lifted.
 */
export function lightLevel(p: PlacePreset, ref: PlacePreset = PRESETS.home_day!): number {
  const r = clamp(rawLight(p) / rawLight(ref), 0, 1.2);
  return 0.38 + 0.62 * Math.pow(r, 0.8);
}

/** Normalizes the tone steps so they fall in the same place under any light (Lanternfall's uInkRef). */
export function inkRef(p: PlacePreset): number {
  return 1.18 / (rawLight(p) / Math.PI);
}
