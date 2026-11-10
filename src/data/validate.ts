// Boot-time and test-time data validation (plan 9.2). Returns readable problems; never throws.

import { PLACES } from './places';
import { PRESETS } from './presets';
import { QUALITY, QUALITY_TIERS } from './quality';

/** Decor kinds the renderer knows (src/render/decor-models.ts). Kept here so sim/tests need no three.js. */
export const DECOR_KINDS = ['oak', 'birch', 'bush', 'pine', 'willow', 'reedclump', 'rock', 'cherry', 'bench'] as const;

const isColor = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffff;

export function validateData(): string[] {
  const problems: string[] = [];
  const kinds = new Set<string>(DECOR_KINDS);
  for (const [key, p] of Object.entries(PLACES)) {
    if (p.id !== key) problems.push(`place ${key}: id "${p.id}" does not match its key`);
    if (!PRESETS[p.preset]) problems.push(`place ${key}: unknown preset "${p.preset}"`);
    if (p.halfW <= 0 || p.halfH <= 0) problems.push(`place ${key}: halfW and halfH must be positive`);
    const inside = (x: number, z: number, m: number) => Math.abs(x) <= p.halfW - m && Math.abs(z) <= p.halfH - m;
    if (!inside(p.spawn.x, p.spawn.z, 1)) problems.push(`place ${key}: spawn is outside the valley floor`);
    if (Math.hypot(p.spawn.x - p.pond.x, p.spawn.z - p.pond.z) < p.pond.r + 1) problems.push(`place ${key}: spawn is in the pond`);
    if (!inside(p.pond.x, p.pond.z, p.pond.r)) problems.push(`place ${key}: pond pokes outside the valley floor`);
    if (p.path.length < 2) problems.push(`place ${key}: the path needs at least two points`);
    const ids = new Set<string>();
    for (const prop of p.props) {
      if (ids.has(prop.id)) problems.push(`place ${key}: duplicate prop id "${prop.id}"`);
      ids.add(prop.id);
      if (!kinds.has(prop.kind)) problems.push(`place ${key}: prop "${prop.id}" has unknown kind "${prop.kind}"`);
      if (!inside(prop.x, prop.z, 0.5)) problems.push(`place ${key}: prop "${prop.id}" is outside the valley floor`);
    }
    for (const [k, w] of p.decor.kinds) {
      if (!kinds.has(k)) problems.push(`place ${key}: decor kind "${k}" is unknown`);
      if (!(w > 0)) problems.push(`place ${key}: decor weight for "${k}" must be positive`);
    }
  }
  for (const [key, pr] of Object.entries(PRESETS)) {
    if (pr.id !== key) problems.push(`preset ${key}: id "${pr.id}" does not match its key`);
    for (const [f, v] of Object.entries(pr)) {
      const colorField = /^(ground|rock|path|shore|peak$|water|zenith|horizon|low|cloud|sunColor|hemiSky|hemiGround|fog$|rim|rayColor)/.test(f);
      if (colorField && !isColor(v)) problems.push(`preset ${key}: ${f} is not a 0xRRGGBB color`);
    }
    if (!(pr.fogDensity > 0)) problems.push(`preset ${key}: fogDensity must be positive`);
    if (Math.hypot(...pr.sunDir) < 0.1) problems.push(`preset ${key}: sunDir is too short`);
  }
  for (const t of QUALITY_TIERS) if (!QUALITY[t]) problems.push(`quality tier ${t} is missing`);
  return problems;
}
