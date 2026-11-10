// Boot-time and test-time data validation (plan 9.2). Returns readable problems; never throws.

import { BUILDINGS, buildingCost } from './buildings';
import { CAMERA_OPTIONS, SCALE_OPTIONS } from './feel';
import { MATERIALS, NODE_KINDS, SATCHEL_CAP } from './gathering';
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
    for (const n of p.nodes) {
      if (ids.has(n.id)) problems.push(`place ${key}: duplicate id "${n.id}"`);
      ids.add(n.id);
      if (!NODE_KINDS[n.kind]) problems.push(`place ${key}: node "${n.id}" has unknown kind "${n.kind}"`);
      if (!inside(n.x, n.z, 1)) problems.push(`place ${key}: node "${n.id}" is outside the valley floor`);
    }
    for (const st of p.sites) {
      if (ids.has(st.id)) problems.push(`place ${key}: duplicate id "${st.id}"`);
      ids.add(st.id);
      const b = BUILDINGS[st.building];
      if (!b) problems.push(`place ${key}: site "${st.id}" has unknown building "${st.building}"`);
      else if (b.place !== p.id) problems.push(`place ${key}: site "${st.id}" builds "${b.id}", which belongs to ${b.place}`);
      if (!inside(st.x, st.z, 3)) problems.push(`place ${key}: site "${st.id}" is too close to the valley edge`);
      for (const n of p.nodes) {
        if (b && Math.hypot(n.x - st.x, n.z - st.z) < b.siteRadius + NODE_KINDS[n.kind].radius) problems.push(`place ${key}: node "${n.id}" overlaps site "${st.id}"`);
      }
    }
    if (!(p.mist.clearAt > 0 && p.mist.clearAt <= 1)) problems.push(`place ${key}: mist.clearAt must be in (0, 1]`);
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
  for (const [key, b] of Object.entries(BUILDINGS)) {
    if (b.id !== key) problems.push(`building ${key}: id "${b.id}" does not match its key`);
    if (!PLACES[b.place]) problems.push(`building ${key}: unknown place "${b.place}"`);
    if (b.parts.length === 0) problems.push(`building ${key}: needs at least one part`);
    const partIds = new Set<string>();
    for (const part of b.parts) {
      if (partIds.has(part.id)) problems.push(`building ${key}: duplicate part "${part.id}"`);
      partIds.add(part.id);
      if (!MATERIALS.includes(part.material)) problems.push(`building ${key}: part "${part.id}" uses unknown material "${part.material}"`);
    }
    for (const [m, n] of Object.entries(buildingCost(b))) {
      if (n! > SATCHEL_CAP * 4) problems.push(`building ${key}: ${n} ${m} is more than four full satchels`);
    }
    if (!(b.restoration >= 0 && b.restoration <= 1)) problems.push(`building ${key}: restoration must be in [0, 1]`);
    if (!(b.siteRadius > b.solidRadius + 0.6)) problems.push(`building ${key}: siteRadius must clear the footprint so the caretaker can reach it`);
  }
  for (const [key, k] of Object.entries(NODE_KINDS)) {
    if (!(k.units >= 1 && Number.isInteger(k.units))) problems.push(`node kind ${key}: units must be a whole number >= 1`);
    if (!(k.radius > k.solidRadius + 0.4)) problems.push(`node kind ${key}: radius must reach past the solid part`);
    if (!(k.restSeconds >= 0 && k.regrowSecondsPerUnit > 0)) problems.push(`node kind ${key}: regrow times must be positive`);
  }
  if (new Set(CAMERA_OPTIONS.map((c) => c.id)).size !== CAMERA_OPTIONS.length) problems.push('camera options: duplicate id');
  if (new Set(SCALE_OPTIONS.map((c) => c.id)).size !== SCALE_OPTIONS.length) problems.push('scale options: duplicate id');
  for (const t of QUALITY_TIERS) if (!QUALITY[t]) problems.push(`quality tier ${t} is missing`);
  return problems;
}
