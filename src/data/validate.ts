// Boot-time and test-time data validation (plan 9.2). Returns readable problems; never throws.

import { PLACES } from './places';
import { PRESETS } from './presets';
import { QUALITY, QUALITY_TIERS } from './quality';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function validateData(): string[] {
  const problems: string[] = [];
  for (const [key, p] of Object.entries(PLACES)) {
    if (p.id !== key) problems.push(`place ${key}: id "${p.id}" does not match its key`);
    if (!PRESETS[p.preset]) problems.push(`place ${key}: unknown preset "${p.preset}"`);
    if (p.islandRadius <= 0) problems.push(`place ${key}: islandRadius must be positive`);
    const inside = (x: number, z: number, margin: number) => Math.hypot(x, z) <= p.islandRadius - margin;
    if (!inside(p.spawn.x, p.spawn.z, 1)) problems.push(`place ${key}: spawn is outside the island`);
    if (Math.hypot(p.spawn.x - p.pond.x, p.spawn.z - p.pond.z) < p.pond.r + 0.5) problems.push(`place ${key}: spawn is in the pond`);
    if (!inside(p.pond.x, p.pond.z, p.pond.r)) problems.push(`place ${key}: pond pokes outside the island`);
    const ids = new Set<string>();
    for (const prop of p.props) {
      if (ids.has(prop.id)) problems.push(`place ${key}: duplicate prop id "${prop.id}"`);
      ids.add(prop.id);
      if (!inside(prop.x, prop.z, 0.5)) problems.push(`place ${key}: prop "${prop.id}" is outside the island`);
    }
    for (const [name, c] of Object.entries(p.palette)) if (!HEX.test(c)) problems.push(`place ${key}: palette.${name} "${c}" is not #RRGGBB`);
  }
  for (const [key, pr] of Object.entries(PRESETS)) {
    if (pr.id !== key) problems.push(`preset ${key}: id "${pr.id}" does not match its key`);
    for (const f of ['skyTop', 'skyHorizon', 'fogColor', 'sunColor', 'hemiSky', 'hemiGround'] as const) {
      if (!HEX.test(pr[f])) problems.push(`preset ${key}: ${f} "${pr[f]}" is not #RRGGBB`);
    }
    if (pr.fogNear >= pr.fogFar) problems.push(`preset ${key}: fogNear must be below fogFar`);
  }
  for (const t of QUALITY_TIERS) if (!QUALITY[t]) problems.push(`quality tier ${t} is missing`);
  return problems;
}
