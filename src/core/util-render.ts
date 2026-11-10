// Copied from Lanternfall (games/lanternfall/src/core/util-render.ts @ b282628). Unchanged.
import { DataUtils } from 'three';

export { clamp, fbm, makeRng, smoothstep } from './util';

export const DataUtilsHalf = (v: number) => DataUtils.toHalfFloat(Math.max(-60000, Math.min(60000, v)));
