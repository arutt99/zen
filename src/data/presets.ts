// Lighting / atmosphere presets. Phase 0 has one daytime preset; Phase 2 adds dawn, golden hour,
// dusk and night, blended from the clock. Colors are hex strings so they stay plain data.

export interface LightPreset {
  id: string;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  sunDirection: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  /** Post-process grade: saturation multiplier and warm tint strength. */
  saturation: number;
  warmth: number;
}

export const PRESETS: Record<string, LightPreset> = {
  day: {
    id: 'day',
    skyTop: '#9EC3D4',
    skyHorizon: '#F2E4C8',
    fogColor: '#E9DFC6',
    fogNear: 30,
    fogFar: 95,
    sunColor: '#FFF1D6',
    sunIntensity: 2.4,
    sunDirection: [0.55, 0.85, 0.35],
    hemiSky: '#DCE8E0',
    hemiGround: '#A08A6A',
    hemiIntensity: 1.1,
    saturation: 0.92,
    warmth: 0.06,
  },
};
