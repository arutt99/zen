// A place's preset in a season (plan 5): the season look (src/data/seasons.ts) moves the ground, grass,
// flowers, path, water, fog, peaks and grade of any time-of-day preset toward the season. Light, sky and
// the time of day are untouched, so dawn is dawn in every season. Pure, no three.js.
import type { PlacePreset } from '../data/presets';
import type { SeasonLook } from '../data/seasons';

export function mixColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ch = (s: number) => {
    const x = (a >> s) & 255, y = (b >> s) & 255;
    return Math.round(x + (y - x) * k) & 255;
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function seasonalPreset(p: PlacePreset, s: SeasonLook): PlacePreset {
  const g = s.groundMix;
  return {
    ...p,
    groundA: mixColor(p.groundA, s.ground[0], g),
    groundB: mixColor(p.groundB, s.ground[1], g),
    groundC: mixColor(p.groundC, s.ground[2], g),
    shore: mixColor(p.shore, s.ground[2], g * 0.6),
    hemiGround: mixColor(p.hemiGround, s.ground[1], g * 0.35),
    grass: [mixColor(p.grass[0], s.grass[0], s.grassMix), mixColor(p.grass[1], s.grass[1], s.grassMix)],
    grassDensity: p.grassDensity * s.grassDensity,
    flowers: s.flowers.length ? [...s.flowers] : p.flowers,
    flowerDensity: (p.flowerDensity ?? 1) * s.flowerDensity,
    pathA: mixColor(p.pathA, s.path, s.pathMix),
    pathB: mixColor(p.pathB, s.path, s.pathMix * 0.85),
    waterShallow: mixColor(p.waterShallow, s.water[0], s.waterMix),
    waterDeep: mixColor(p.waterDeep, s.water[1], s.waterMix),
    fog: mixColor(p.fog, s.fog, s.fogMix),
    peak: mixColor(p.peak, s.peak, 0.6),
    peakH: p.peakH - s.peakDrop,
    ink: { ...p.ink, tint: s.inkTint ? mix3(p.ink.tint, s.inkTint, g) : p.ink.tint },
    grade: {
      lift: p.grade.lift,
      gain: [p.grade.gain[0] * s.gain[0], p.grade.gain[1] * s.gain[1], p.grade.gain[2] * s.gain[2]],
      sat: p.grade.sat * s.sat,
    },
    pollen: p.pollen * (s.butterflies > 0 ? 1 : 0.2),
  };
}
