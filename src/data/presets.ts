// Place presets: light, sky, fog, ground and water colors for one place at one time of day.
// The shape is Lanternfall's Biome (render/biomes.ts) minus the tower-defense-only fields; the
// day preset started from Lanternfall's meadow. Phase 2 adds dawn, golden hour, dusk and night
// (plan 5), blended from the clock by src/core/daylight.ts along each place's day cycle.
// Colors are 0xRRGGBB numbers. The look preset (src/data/looks.ts) grades all of them on top.

export interface PlacePreset {
  id: string;
  groundA: number; groundB: number; groundC: number;
  rockA: number; rockB: number;
  /** The packed-earth path. */
  pathA: number; pathB: number;
  shore: number;
  peak: number; peakH: number;
  waterShallow: number; waterDeep: number;
  zenith: number; horizon: number; low: number;
  cloudLit: number; cloudShade: number;
  sunColor: number; sunI: number; sunDir: [number, number, number];
  hemiSky: number; hemiGround: number; hemiI: number;
  envI: number;
  fog: number; fogDensity: number;
  rim: number;
  grass: [number, number];
  grassDensity: number;
  flowers: number[];
  /** Ambient particles: daytime pollen and night fireflies, 0..1 each (they cross-fade). */
  pollen: number;
  fireflies: number;
  /** Stars in the sky, 0..1. */
  stars: number;
  /** Lantern glow strength (stone lanterns, the hall's paper lanterns). */
  glow: number;
  rays: number;
  rayColor: number;
  grade: { lift: [number, number, number]; gain: [number, number, number]; sat: number };
  /** Painted ground: a color tint, and how far the lightest patch shifts to groundC. */
  ink: { tint: [number, number, number]; high: number };
}

const HOME_DAY: PlacePreset = {
  id: 'home_day',
  // Lanternfall's meadow, with the plan's palette nudged in: softer greens, warm paper path, jade water.
  ink: { tint: [0.92, 1.0, 0.8], high: 0 },
  groundA: 0x67924a, groundB: 0x8aac5c, groundC: 0xb5bd73, rockA: 0x75705f, rockB: 0xb0aa94,
  pathA: 0xd9c39d, pathB: 0xa48a62, shore: 0xd9caa0, peak: 0xe9eadf, peakH: 14,
  waterShallow: 0x9cc7b8, waterDeep: 0x3f7f7a,
  zenith: 0x5a95d0, horizon: 0xffe8c4, low: 0xf2cfa4, cloudLit: 0xfff6e8, cloudShade: 0xd8a896,
  sunColor: 0xffe6c0, sunI: 3.4, sunDir: [-0.55, 0.74, 0.4], hemiSky: 0xcfe0f5, hemiGround: 0x7a8048, hemiI: 1.25, envI: 0.45,
  fog: 0xf2dcb8, fogDensity: 0.0042, rim: 0xffdcb0, grass: [0x557f38, 0xaac65a], grassDensity: 1,
  flowers: [0xfff2c2, 0xe9a9b8, 0xffffff, 0xc8a6e0],
  pollen: 1, fireflies: 0, stars: 0, glow: 0.45,
  rays: 5, rayColor: 0xffe8be,
  grade: { lift: [0.012, 0.006, 0.002], gain: [1.04, 1.01, 0.97], sat: 1.04 },
};

export const PRESETS: Record<string, PlacePreset> = {
  home_day: HOME_DAY,
  home_dawn: {
    ...HOME_DAY, id: 'home_dawn',
    sunColor: 0xffc8a8, sunI: 2.3, sunDir: [0.82, 0.26, 0.35], hemiSky: 0xc4c8e2, hemiGround: 0x5e6248, hemiI: 1.05, envI: 0.38,
    zenith: 0x7d9ad2, horizon: 0xffd2bc, low: 0xe2b8b2, cloudLit: 0xffe6de, cloudShade: 0xb898a8,
    fog: 0xead2ca, fogDensity: 0.0056, rim: 0xffd0b4,
    waterShallow: 0xa6c4c0, waterDeep: 0x3d6f78,
    pollen: 0.6, fireflies: 0.08, stars: 0.1, glow: 0.7,
    grade: { lift: [0.012, 0.008, 0.016], gain: [1.03, 1.0, 0.99], sat: 0.98 },
  },
  home_golden: {
    ...HOME_DAY, id: 'home_golden',
    sunColor: 0xffc27a, sunI: 3.0, sunDir: [-0.82, 0.34, 0.3], hemiSky: 0xe8d0b2, hemiGround: 0x6c6240, hemiI: 1.05, envI: 0.42,
    zenith: 0x6f90c2, horizon: 0xffc88e, low: 0xf2b07e, cloudLit: 0xffdcb2, cloudShade: 0xc88a7c,
    fog: 0xf2c894, rim: 0xffc48a,
    pollen: 1, fireflies: 0, stars: 0, glow: 0.6,
    grade: { lift: [0.02, 0.008, 0], gain: [1.08, 1.0, 0.9], sat: 1.06 },
  },
  home_dusk: {
    ...HOME_DAY, id: 'home_dusk',
    sunColor: 0xffaa7c, sunI: 1.8, sunDir: [-0.86, 0.2, 0.42], hemiSky: 0xb0a0b0, hemiGround: 0x54483a, hemiI: 1.0, envI: 0.32,
    zenith: 0x4a5a90, horizon: 0xf2a28a, low: 0xb27c82, cloudLit: 0xf6b8a0, cloudShade: 0x7a6080,
    fog: 0xc8a2a2, fogDensity: 0.0048, rim: 0xffb092,
    waterShallow: 0x8eaab0, waterDeep: 0x2e5262,
    pollen: 0.25, fireflies: 0.55, stars: 0.35, glow: 1.15,
    grade: { lift: [0.012, 0.006, 0.022], gain: [1.02, 0.96, 0.98], sat: 0.98 },
  },
  home_night: {
    ...HOME_DAY, id: 'home_night',
    // Moonlight: soft blue key from the south-east, a lifted sky so night stays readable, not dark.
    sunColor: 0x9cb2e2, sunI: 1.15, sunDir: [0.42, 0.72, 0.38], hemiSky: 0x5c6c9c, hemiGround: 0x2c3232, hemiI: 0.85, envI: 0.25,
    zenith: 0x1c2648, horizon: 0x4c5c82, low: 0x2c3252, cloudLit: 0x8c9ac2, cloudShade: 0x3a4062,
    fog: 0x4c5a7a, fogDensity: 0.005, rim: 0x9cb8e2,
    waterShallow: 0x5c8c92, waterDeep: 0x1a3a4a,
    pollen: 0, fireflies: 1, stars: 1, glow: 1.5,
    grade: { lift: [0, 0.006, 0.022], gain: [0.95, 0.98, 1.08], sat: 0.86 },
  },
};

/**
 * A place's day: preset keys at fractions of the day (0 = midnight, 0.5 = noon), blended smoothly
 * between neighbours and wrapping around midnight. Clock times assume a spring day (Phase 5 adds seasons).
 */
export const DAY_CYCLES: Record<string, [number, string][]> = {
  home: [
    [0.21, 'home_night'], // 05:00
    [0.26, 'home_dawn'], // 06:15
    [0.33, 'home_day'], // 08:00
    [0.68, 'home_day'], // 16:20
    [0.74, 'home_golden'], // 17:45
    [0.8, 'home_dusk'], // 19:10
    [0.86, 'home_night'], // 20:40
  ],
};

/** Named moments for the debug slider and screenshot sets, as fractions of the day. */
export const MOMENTS = { dawn: 0.26, day: 0.5, golden: 0.74, dusk: 0.8, night: 0.95 } as const;
