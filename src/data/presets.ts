// Place presets: light, sky, fog, ground and water colors for one place at one time of day.
// The shape is Lanternfall's Biome (render/biomes.ts) minus the tower-defense-only fields; the
// first preset starts from Lanternfall's meadow. Phase 2 adds dawn, golden hour, dusk and night
// and retunes toward the painted reference (plan 7.1). Colors are 0xRRGGBB numbers.

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
  ambient: 'pollen' | 'fireflies' | 'petals';
  rays: number;
  rayColor: number;
  grade: { lift: [number, number, number]; gain: [number, number, number]; sat: number };
  /** Painted ground for the inked style: a color tint, and how far the lightest patch shifts to groundC. */
  ink: { tint: [number, number, number]; high: number };
}

export const PRESETS: Record<string, PlacePreset> = {
  home_day: {
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
    ambient: 'pollen', rays: 5, rayColor: 0xffe8be,
    grade: { lift: [0.012, 0.006, 0.002], gain: [1.04, 1.01, 0.97], sat: 1.04 },
  },
};
