// Boot-time and test-time data validation (plan 9.2). Returns readable problems; never throws.

import { BUILDINGS, BUILDING_IDS, buildingCost } from './buildings';
import { CAMERA_OPTIONS, SCALE_OPTIONS } from './feel';
import { MATERIALS, NODE_KINDS, SATCHEL_CAP } from './gathering';
import { PLACES } from './places';
import { ANIMALS } from './animals';
import { RITUALS } from './rituals';
import { WORDS } from './words';
import { CARETAKER, CHARACTER_STYLES, CARETAKER_HEIGHT, caretakerHeight } from './characters';
import { LOOKS, LOOK_IDS } from './looks';
import { DAY_CYCLES, PRESETS } from './presets';
import { QUALITY, QUALITY_TIERS } from './quality';

/** Decor kinds the renderer knows (src/render/decor-models.ts). Kept here so sim/tests need no three.js. */
export const DECOR_KINDS = [
  'oak', 'birch', 'bush', 'pine', 'willow', 'reedclump', 'rock', 'cherry', 'bench',
  // Phase 2, the Zen kit:
  'maple', 'bamboo', 'mossy_stone', 'stone_lantern', 'fence_wood', 'fence_rope', 'raked_gravel', 'stepping_stone', 'lotus',
  // Phase 3: the old gate, restoration props (overgrowth and what replaces it), poem stones and note posts.
  'old_gate', 'bramble', 'tall_weeds', 'flower_bed', 'iris', 'path_lantern', 'trail_gate_shut', 'trail_gate_open', 'poem_stone', 'note_post',
  // Phase 4: the travel map board, bamboo fences, fallen culms (grove overgrowth) and ferns.
  'map_board', 'fence_bamboo', 'fallen_bamboo', 'fern',
] as const;

const isColor = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffff;

export function validateData(): string[] {
  const problems: string[] = [];
  const kinds = new Set<string>(DECOR_KINDS);
  for (const [key, p] of Object.entries(PLACES)) {
    if (p.id !== key) problems.push(`place ${key}: id "${p.id}" does not match its key`);
    const cycle = DAY_CYCLES[p.daylight];
    if (!cycle) problems.push(`place ${key}: unknown day cycle "${p.daylight}"`);
    else {
      cycle.forEach(([t, id], i) => {
        if (!PRESETS[id]) problems.push(`day cycle ${p.daylight}: unknown preset "${id}"`);
        if (!(t >= 0 && t < 1)) problems.push(`day cycle ${p.daylight}: time ${t} is outside [0, 1)`);
        if (i > 0 && !(t > cycle[i - 1]![0])) problems.push(`day cycle ${p.daylight}: times must increase`);
      });
    }
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
    const built = new Set(p.sites.map((st) => st.building));
    const gate = (what: string, req: string | undefined) => {
      if (req && !built.has(req as never)) problems.push(`place ${key}: ${what} requires "${req}", which has no site here`);
    };
    for (const st of p.sites) for (const st2 of p.sites) {
      if (st !== st2 && BUILDINGS[st.building] && BUILDINGS[st2.building]) {
        const need = BUILDINGS[st.building].siteRadius + BUILDINGS[st2.building].siteRadius;
        if (Math.hypot(st.x - st2.x, st.z - st2.z) < need) problems.push(`place ${key}: sites "${st.id}" and "${st2.id}" overlap`);
      }
    }
    for (const sit of p.sits) {
      if (ids.has(sit.id)) problems.push(`place ${key}: duplicate id "${sit.id}"`);
      ids.add(sit.id);
      gate(`sit spot "${sit.id}"`, sit.requires);
      if (!inside(sit.x, sit.z, 1)) problems.push(`place ${key}: sit spot "${sit.id}" is outside the valley floor`);
    }
    for (const w of p.words) {
      if (!WORDS[w.id]) problems.push(`place ${key}: unknown words "${w.id}"`);
      if (ids.has(w.id)) problems.push(`place ${key}: duplicate id "${w.id}"`);
      ids.add(w.id);
      gate(`words "${w.id}"`, w.requires);
      if (!inside(w.x, w.z, 1)) problems.push(`place ${key}: words "${w.id}" are outside the valley floor`);
    }
    for (const g of p.growth) {
      if (ids.has(g.id)) problems.push(`place ${key}: duplicate id "${g.id}"`);
      ids.add(g.id);
      if (!kinds.has(g.kind)) problems.push(`place ${key}: growth "${g.id}" has unknown kind "${g.kind}"`);
      if (g.min === undefined && g.max === undefined) problems.push(`place ${key}: growth "${g.id}" needs min or max`);
      if (g.min !== undefined && g.max !== undefined && !(g.min < g.max)) problems.push(`place ${key}: growth "${g.id}" min must be below max`);
      if (!inside(g.x, g.z, 0.5)) problems.push(`place ${key}: growth "${g.id}" is outside the valley floor`);
      for (const st of p.sites) {
        const b = BUILDINGS[st.building];
        if (b && Math.hypot(g.x - st.x, g.z - st.z) < b.siteRadius + 0.3) problems.push(`place ${key}: growth "${g.id}" sits on site "${st.id}"`);
      }
    }
    for (const g of p.growth) gate(`growth "${g.id}"`, g.requires);
    // Phase 4: exits, arrivals and the map board.
    if (!inside(p.map.x, p.map.z, 1)) problems.push(`place ${key}: the map board is outside the valley floor`);
    if (!(p.map.at.x >= 0 && p.map.at.x <= 100 && p.map.at.y >= 0 && p.map.at.y <= 60)) problems.push(`place ${key}: map.at is off the painted map`);
    if (!p.arrivals.map) problems.push(`place ${key}: needs a "map" arrival (travel by map)`);
    for (const [aid, a] of Object.entries(p.arrivals)) {
      if (!inside(a.x, a.z, 1)) problems.push(`place ${key}: arrival "${aid}" is outside the valley floor`);
      for (const e of p.exits) if (Math.hypot(a.x - e.x, a.z - e.z) < e.r + 1.5) problems.push(`place ${key}: arrival "${aid}" is inside exit "${e.id}" (you would leave at once)`);
    }
    for (const e of p.exits) {
      if (ids.has(e.id)) problems.push(`place ${key}: duplicate id "${e.id}"`);
      ids.add(e.id);
      const to = PLACES[e.to];
      if (!to) problems.push(`place ${key}: exit "${e.id}" goes to unknown place "${e.to}"`);
      else if (!to.arrivals[e.arrive]) problems.push(`place ${key}: exit "${e.id}" arrives at unknown point "${e.arrive}" in ${e.to}`);
      if (e.to === p.id) problems.push(`place ${key}: exit "${e.id}" leads to itself`);
      if (Math.abs(e.x) > p.halfW + 1.5 || Math.abs(e.z) > p.halfH + 1.5) problems.push(`place ${key}: exit "${e.id}" is beyond the walkable edge`);
      gate(`exit "${e.id}"`, e.requires);
      if (e.requires && !(e.closed?.length)) problems.push(`place ${key}: exit "${e.id}" has requires but nothing closing it`);
    }
    if (!(p.water.murk >= 0 && p.water.murk <= 1 && p.water.clearAt > 0)) problems.push(`place ${key}: water murk/clearAt out of range`);
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
    const siteCount = Object.values(PLACES).reduce((n, p) => n + p.sites.filter((st) => st.building === b.id).length, 0);
    if (siteCount !== 1) problems.push(`building ${key}: has ${siteCount} sites (needs exactly one)`);
    if (!PLACES[b.place]) problems.push(`building ${key}: unknown place "${b.place}"`);
    if (b.parts.length === 0) problems.push(`building ${key}: needs at least one part`);
    const partIds = new Set<string>();
    for (const part of b.authored) {
      if (part.pieces !== undefined && !(Number.isInteger(part.pieces) && part.pieces >= 1 && part.pieces <= 12)) problems.push(`building ${key}: part "${part.id}" needs 1–12 whole pieces`);
      if (partIds.has(part.id)) problems.push(`building ${key}: duplicate part "${part.id}"`);
      partIds.add(part.id);
      if (!MATERIALS.includes(part.material)) problems.push(`building ${key}: part "${part.id}" uses unknown material "${part.material}"`);
    }
    // Mixed materials: a part rests only on the ground or on an earlier part of its own material, so any
    // mix of wood and stone deliveries looks whole (see src/data/buildings.ts).
    b.parts.forEach((part, i) => {
      if (!part.on) return;
      const j = b.parts.findIndex((q) => q.id === part.on);
      if (j < 0) problems.push(`building ${key}: part "${part.id}" rests on unknown part "${part.on}"`);
      else if (j >= i) problems.push(`building ${key}: part "${part.id}" rests on "${part.on}", which comes later`);
      else if (b.parts[j]!.material !== part.material) problems.push(`building ${key}: part "${part.id}" (${part.material}) rests on "${part.on}" (${b.parts[j]!.material})`);
    });
    for (const r of b.requires) {
      if (!BUILDINGS[r]) problems.push(`building ${key}: requires unknown building "${r}"`);
      else if (r === b.id) problems.push(`building ${key}: requires itself`);
      else if (BUILDING_IDS.indexOf(r) > BUILDING_IDS.indexOf(b.id)) problems.push(`building ${key}: requires "${r}", which comes later in BUILDING_IDS`);
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
  for (const id of LOOK_IDS) {
    const l = LOOKS[id];
    if (!l || l.id !== id) { problems.push(`look ${id}: missing or id mismatch`); continue; }
    const [a, b, c] = l.shading.levels;
    if (!(a > 0 && a <= b && b <= c)) problems.push(`look ${id}: shading levels must rise`);
    if (!(l.shading.steps[0] < l.shading.steps[1])) problems.push(`look ${id}: shading steps must rise`);
    if (!(l.shading.softness > 0)) problems.push(`look ${id}: shading softness must be positive`);
    if (!(l.outline.width >= 0 && l.outline.width < 0.01)) problems.push(`look ${id}: outline width looks wrong`);
    if (!(l.albedo.sat >= 0 && l.albedo.lift >= 0 && l.albedo.lift <= 1)) problems.push(`look ${id}: albedo remap out of range`);
  }
  for (const s of CHARACTER_STYLES) {
    const h = caretakerHeight(CARETAKER[s]);
    if (Math.abs(h - CARETAKER_HEIGHT) > 0.08) problems.push(`caretaker ${s}: ${h.toFixed(2)} m tall, should be ~${CARETAKER_HEIGHT} m (A3)`);
    if (!(CARETAKER[s].hip < CARETAKER[s].shoulder)) problems.push(`caretaker ${s}: hip must be below the shoulders`);
  }
  for (const [key, a] of Object.entries(ANIMALS)) {
    if (a.id !== key) problems.push(`animal ${key}: id mismatch`);
    if (!PLACES[a.place]) problems.push(`animal ${key}: unknown place "${a.place}"`);
    if (!(a.minRestoration >= 0 && a.minRestoration <= 1)) problems.push(`animal ${key}: minRestoration must be in [0, 1]`);
    if (!(a.linger[0] > 0 && a.linger[0] <= a.linger[1])) problems.push(`animal ${key}: linger must be a positive range`);
  }
  for (const [key, r] of Object.entries(RITUALS)) {
    if (r.id !== key) problems.push(`ritual ${key}: id mismatch`);
    if (!BUILDINGS[r.building]) problems.push(`ritual ${key}: unknown building "${r.building}"`);
    if (!(r.radius > 0.5 && r.seconds > 0)) problems.push(`ritual ${key}: radius and seconds must be positive`);
  }
  for (const [key, w] of Object.entries(WORDS)) {
    if (w.id !== key) problems.push(`words ${key}: id mismatch`);
    if (w.lines.length === 0 || w.lines.some((l) => !l.trim())) problems.push(`words ${key}: needs non-empty lines`);
    if (w.kind === 'poem' && w.lines.length !== 3) problems.push(`words ${key}: a poem has three lines`);
  }
  return problems;
}
