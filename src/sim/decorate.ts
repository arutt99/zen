// Decorating v1 rules (plan 10 Phase 5): where a decoration may go. Headless, no three.js.
// A decoration needs decoration-allowed ground (a place with DECORATE data, its valley floor, dry and off the
// path), room around it, and must never cut the caretaker off from anything the game needs: every gather
// node, build site, sit spot, poem stone, find, the map board and the ways out must stay reachable from the
// place's way in (pillar: no soft-locks). The cheap checks run every frame for the ghost; the flood fill runs
// once, when the caretaker places it.
import { BUILDINGS } from '../data/buildings';
import { DECORATE, DECORATIONS, DECOR_CLEAR } from '../data/decorations';
import { FINDS } from '../data/finds';
import { NODE_KINDS } from '../data/gathering';
import type { PlaceDef } from '../data/places';
import type { Decoration } from './state';
import type { Blocker } from './walker';
import { WALKER } from '../data/feel';

export interface DecorGround {
  walkable(x: number, z: number): boolean;
  /** Distance to the nearest packed-earth path or trail centre line. */
  roadDistance(x: number, z: number): number;
  readonly pathWidth: number;
  /** Fixed solids: trunks, rocks and props (the island generator's). */
  readonly solids: readonly Blocker[];
}

export type PlaceProblem = 'not_here' | 'full' | 'path' | 'water' | 'crowded' | 'in_the_way' | 'blocks_way';

/** The circles a set of decorations adds to the place's collision (the solid ones). */
export function decorationBlockers(decorations: readonly Decoration[], place: string): Blocker[] {
  return decorations.filter((d) => d.place === place && DECORATIONS[d.id] && DECORATIONS[d.id]!.solid > 0)
    .map((d) => ({ x: d.x, z: d.z, r: DECORATIONS[d.id]!.solid }));
}

/** Things the caretaker must keep reaching, with how close counts as reached. */
export function mustReach(place: PlaceDef): { x: number; z: number; r: number }[] {
  return [
    ...place.nodes.map((n) => ({ x: n.x, z: n.z, r: NODE_KINDS[n.kind].radius })),
    ...place.sites.map((s) => ({ x: s.x, z: s.z, r: BUILDINGS[s.building].siteRadius })),
    ...place.sits.map((s) => ({ x: s.x, z: s.z, r: 2.1 })),
    ...place.words.map((w) => ({ x: w.x, z: w.z, r: 1.9 })),
    ...Object.values(FINDS).filter((f) => f.place === place.id).map((f) => ({ x: f.x, z: f.z, r: 1.6 })),
    { x: place.map.x + Math.sin(place.map.rot) * 1.2, z: place.map.z + Math.cos(place.map.rot) * 1.2, r: 2.0 },
    ...place.exits.map((e) => ({ x: e.x, z: e.z, r: e.r })),
  ];
}

/**
 * Quick check for a spot (every frame, for the ghost's tint). Null when it may go there; otherwise why not.
 * `others` are the decorations already placed in this place.
 */
export function placementProblem(place: PlaceDef, ground: DecorGround, others: readonly Decoration[], id: string, x: number, z: number, caretaker?: { x: number; z: number }): PlaceProblem | null {
  const def = DECORATIONS[id];
  const limit = DECORATE[place.id]?.max ?? 0;
  if (!def || limit <= 0) return 'not_here';
  if (others.filter((d) => d.place === place.id).length >= limit) return 'full';
  if (Math.abs(x) > place.halfW - 1 || Math.abs(z) > place.halfH - 1) return 'not_here';
  // The spot and a ring around it must be dry, standable ground.
  for (let a = 0; a < 6; a++) {
    const px = x + Math.cos(a * 1.047) * def.room * 0.7, pz = z + Math.sin(a * 1.047) * def.room * 0.7;
    if (!ground.walkable(px, pz)) return 'water';
  }
  if (!ground.walkable(x, z)) return 'water';
  if (ground.roadDistance(x, z) < ground.pathWidth * 0.5 + DECOR_CLEAR.path + def.room * 0.5) return 'path';
  const far = (p: { x: number; z: number }, r: number) => Math.hypot(p.x - x, p.z - z) >= r;
  for (const s of place.sites) if (!far(s, BUILDINGS[s.building].siteRadius + DECOR_CLEAR.site + def.room)) return 'in_the_way';
  for (const n of place.nodes) if (!far(n, NODE_KINDS[n.kind].radius + DECOR_CLEAR.node + def.room * 0.5)) return 'in_the_way';
  for (const p of mustReach(place).slice(place.nodes.length + place.sites.length)) if (!far(p, DECOR_CLEAR.spot + def.room * 0.5)) return 'in_the_way';
  for (const e of place.exits) for (const c of e.closed ?? []) if (!far(c, c.r + def.room + 0.5)) return 'in_the_way';
  for (const b of ground.solids) if (!far(b, b.r + def.room * 0.6)) return 'crowded';
  for (const d of others) {
    if (d.place !== place.id) continue;
    const o = DECORATIONS[d.id];
    if (o && !far(d, (o.room + def.room) * 0.55)) return 'crowded';
  }
  if (caretaker && def.solid > 0 && !far(caretaker, def.solid + DECOR_CLEAR.caretaker)) return 'in_the_way';
  return null;
}

/**
 * The flood fill (0.5 m cells): with every site built and every solid decoration in place, can the caretaker
 * still reach everything in `mustReach` from `from`? Used before a decoration is placed.
 */
export function everythingReachable(place: PlaceDef, ground: DecorGround, decorations: readonly Decoration[], from: { x: number; z: number }): boolean {
  const S = 0.5;
  const r = WALKER.radius;
  const blockers: Blocker[] = [
    ...ground.solids,
    ...place.nodes.map((n) => ({ x: n.x, z: n.z, r: NODE_KINDS[n.kind].solidRadius })),
    ...place.sites.map((s) => ({ x: s.x, z: s.z, r: BUILDINGS[s.building].solidRadius })),
    ...decorationBlockers(decorations, place.id),
  ];
  const W = Math.ceil((place.halfW + 1) / S), H = Math.ceil((place.halfH + 1) / S);
  const cols = 2 * W + 1, rows = 2 * H + 1;
  const blocked = new Uint8Array(cols * rows);
  for (let j = -H; j <= H; j++) for (let i = -W; i <= W; i++) if (!ground.walkable(i * S, j * S)) blocked[(j + H) * cols + (i + W)] = 1;
  for (const b of blockers) {
    const rr = b.r + r;
    const i0 = Math.max(-W, Math.floor((b.x - rr) / S)), i1 = Math.min(W, Math.ceil((b.x + rr) / S));
    const j0 = Math.max(-H, Math.floor((b.z - rr) / S)), j1 = Math.min(H, Math.ceil((b.z + rr) / S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(i * S - b.x, j * S - b.z) < rr) blocked[(j + H) * cols + (i + W)] = 1;
  }
  const seen = new Uint8Array(cols * rows);
  const si = Math.round(from.x / S), sj = Math.round(from.z / S);
  if (Math.abs(si) > W || Math.abs(sj) > H) return false;
  const stack = [(sj + H) * cols + (si + W)];
  seen[stack[0]!] = 1;
  while (stack.length) {
    const k = stack.pop()!;
    const i = (k % cols), j = Math.floor(k / cols);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
      const kk = b * cols + a;
      if (seen[kk] || blocked[kk]) continue;
      seen[kk] = 1;
      stack.push(kk);
    }
  }
  const reached = (x: number, z: number, rad: number) => {
    const n = Math.ceil(rad / S);
    const ci = Math.round(x / S), cj = Math.round(z / S);
    for (let b = cj - n; b <= cj + n; b++) for (let a = ci - n; a <= ci + n; a++) {
      if (Math.abs(a) > W || Math.abs(b) > H) continue;
      if (seen[(b + H) * cols + (a + W)] && Math.hypot(a * S - x, b * S - z) <= rad) return true;
    }
    return false;
  };
  return mustReach(place).every((p) => reached(p.x, p.z, Math.max(0.6, p.r - 0.2)));
}

/** The index of the placed decoration nearest (x, z) within `r`, in this place, or -1. */
export function decorationNear(decorations: readonly Decoration[], place: string, x: number, z: number, r = 1.4): number {
  let best = -1, bestD = r;
  decorations.forEach((d, i) => {
    if (d.place !== place) return;
    const dd = Math.hypot(d.x - x, d.z - z);
    if (dd <= bestD) { best = i; bestD = dd; }
  });
  return best;
}
