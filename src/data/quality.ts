// Quality tiers (plan 6): pixel ratio, shadows, grass, particles, painterly pass.
// Balance-style numbers live here, not in render code.

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
export const QUALITY_TIERS: readonly QualityTier[] = ['low', 'medium', 'high', 'ultra'];

export interface QualitySettings {
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  grassBlades: number;
  particles: number;
  painterlyPass: boolean;
  antialias: boolean;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: { maxPixelRatio: 1, shadows: false, shadowMapSize: 512, grassBlades: 600, particles: 40, painterlyPass: false, antialias: false },
  medium: { maxPixelRatio: 1.5, shadows: true, shadowMapSize: 1024, grassBlades: 2000, particles: 90, painterlyPass: true, antialias: false },
  high: { maxPixelRatio: 2, shadows: true, shadowMapSize: 2048, grassBlades: 4500, particles: 160, painterlyPass: true, antialias: true },
  ultra: { maxPixelRatio: 3, shadows: true, shadowMapSize: 4096, grassBlades: 9000, particles: 260, painterlyPass: true, antialias: true },
};

export interface DeviceHints {
  coarsePointer: boolean;
  deviceMemoryGb?: number | undefined;
  hardwareConcurrency?: number | undefined;
  screenMinSide: number;
}

/** Pick a default tier from what the browser tells us. Phones default to Medium (plan 6 target). */
export function defaultTier(h: DeviceHints): QualityTier {
  const mem = h.deviceMemoryGb ?? 4;
  const cores = h.hardwareConcurrency ?? 4;
  // iOS Safari under-reports cores and hides memory, so only clearly weak phones get Low.
  if (h.coarsePointer) return mem <= 2 || cores <= 2 ? 'low' : 'medium';
  if (mem >= 8 && cores >= 8) return 'high';
  return 'medium';
}
