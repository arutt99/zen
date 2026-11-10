// Quality tiers (plan 6). The table is Lanternfall's (render/engine.ts QUALITY), moved to data/ so
// every tunable number lives here. Lanternfall's grass and particle counts are for a 140 m battlefield;
// the home island is smaller, so the stage scales them by area.

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
export const QUALITY_TIERS: readonly QualityTier[] = ['low', 'medium', 'high', 'ultra'];

export interface QualitySettings {
  label: string;
  /**
   * Highest device pixel ratio used. Medium and High were 1.25 (Lanternfall's value), which drew a 3x
   * phone screen at about 40% of its resolution and looked soft; raised to 2 on 2026-11-10 after the
   * owner found Ultra (2) sharp and smooth on their phone. The resolution governor still lowers it on
   * devices that can't keep up.
   */
  dpr: number;
  /** Shadow map size. */
  shadow: number;
  msaa: number;
  /** Tilt-shift blur (classic look only). */
  tilt: boolean;
  /** Kuwahara paint filter (classic look only). */
  painterly: boolean;
  grass: number;
  /** Terrain grid spacing in metres. */
  terrainStep: number;
  particles: number;
  rays: boolean;
  /** Multiplier on ambient particle counts (pollen, fireflies). */
  ambient: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { label: 'Low', dpr: 1, shadow: 1024, msaa: 0, tilt: false, painterly: false, grass: 5000, terrainStep: 1, particles: 5000, rays: false, ambient: 0.4 },
  medium: { label: 'Medium', dpr: 2, shadow: 2048, msaa: 2, tilt: true, painterly: false, grass: 20000, terrainStep: 0.5, particles: 9000, rays: true, ambient: 0.7 },
  high: { label: 'High', dpr: 2, shadow: 3072, msaa: 4, tilt: true, painterly: true, grass: 48000, terrainStep: 0.5, particles: 14000, rays: true, ambient: 1 },
  ultra: { label: 'Ultra', dpr: 2, shadow: 4096, msaa: 4, tilt: true, painterly: true, grass: 90000, terrainStep: 0.5, particles: 20000, rays: true, ambient: 1.4 },
};

export interface DeviceHints {
  coarsePointer: boolean;
  deviceMemoryGb?: number | undefined;
  hardwareConcurrency?: number | undefined;
  /** UNMASKED_RENDERER_WEBGL, lower-cased, if the browser shares it. */
  gpu?: string | undefined;
}

/**
 * Pick a default tier. GPU rules are Lanternfall's detectQuality(); phones default to Medium (plan 6).
 * iOS Safari under-reports cores and hides memory, so only clearly weak phones get Low.
 */
export function defaultTier(h: DeviceHints): QualityTier {
  const gpu = h.gpu ?? '';
  if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) return 'low';
  const mem = h.deviceMemoryGb ?? 4;
  const cores = h.hardwareConcurrency ?? 4;
  if (h.coarsePointer) return mem <= 2 || cores <= 2 ? 'low' : 'medium';
  if (/intel(\(r\))? (hd|uhd) graphics|adreno|mali/.test(gpu)) return 'medium';
  return 'high';
}
