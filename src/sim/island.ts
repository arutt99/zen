// The home island's geometry: path, terrain height, island rim and scattered decor. No rendering.
// Adapted from Lanternfall's World (games/lanternfall/src/sim/world.ts @ b282628): RoadPath,
// catmullRom, resample, the distance field, islandMask and the height function are the same; the
// tower-defense parts (build rules, flight lines, landmarks) are gone, random lakes became the
// place's pond, and decor comes from the place data instead of a biome table.
import { clamp, fbm, lerp, makeRng, noise2, smoothstep } from '../core/util';
import type { PlaceDef } from '../data/places';

const STEP = 0.5;
export class RoadPath {
  /** x, z pairs at fixed STEP arc-length spacing. */
  pts: Float32Array;
  length: number;
  count: number;
  /** Road direction at each point, as x, z pairs. */
  private dirs: Float32Array;
  constructor(pts: Float32Array) {
    this.pts = pts;
    this.count = pts.length / 2;
    this.length = (this.count - 1) * STEP;
    this.dirs = new Float32Array(pts.length);
    for (let i = 0; i < this.count; i++) {
      const a = Math.max(0, i - 1), b = Math.min(this.count - 1, i + 1);
      const dx = pts[b * 2] - pts[a * 2], dz = pts[b * 2 + 1] - pts[a * 2 + 1];
      const l = Math.hypot(dx, dz) || 1;
      this.dirs[i * 2] = dx / l;
      this.dirs[i * 2 + 1] = dz / l;
    }
  }
  /**
   * Writes [x, z, dirX, dirZ] for a distance along the road. The direction blends between points,
   * so anything placed sideways from the road (like enemies off-centre) follows bends without jumping.
   */
  sample(d: number, out: { x: number; z: number; dx: number; dz: number }) {
    const f = clamp(d / STEP, 0, this.count - 1.001);
    const i = Math.floor(f);
    const t = f - i;
    const p = this.pts;
    const ax = p[i * 2], az = p[i * 2 + 1], bx = p[i * 2 + 2], bz = p[i * 2 + 3];
    out.x = ax + (bx - ax) * t;
    out.z = az + (bz - az) * t;
    const n = this.dirs;
    const dx = n[i * 2] + (n[i * 2 + 2] - n[i * 2]) * t;
    const dz = n[i * 2 + 1] + (n[i * 2 + 3] - n[i * 2 + 1]) * t;
    const l = Math.hypot(dx, dz) || 1;
    out.dx = dx / l;
    out.dz = dz / l;
    return out;
  }
}

function catmullRom(ctrl: [number, number][]): [number, number][] {
  const pts: [number, number][] = [];
  const n = ctrl.length;
  const at = (i: number) => {
    if (i < 0) return [2 * ctrl[0][0] - ctrl[1][0], 2 * ctrl[0][1] - ctrl[1][1]];
    if (i >= n) return [2 * ctrl[n - 1][0] - ctrl[n - 2][0], 2 * ctrl[n - 1][1] - ctrl[n - 2][1]];
    return ctrl[i];
  };
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < 40; s++) {
      const t = s / 40;
      const t2 = t * t, t3 = t2 * t;
      const c = (a: number, b: number, c2: number, d: number) =>
        0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      pts.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(ctrl[n - 1]);
  return pts;
}

function resample(raw: [number, number][]): Float32Array {
  const out: number[] = [raw[0][0], raw[0][1]];
  let acc = 0;
  for (let i = 1; i < raw.length; i++) {
    let ax = raw[i - 1][0], az = raw[i - 1][1];
    const bx = raw[i][0], bz = raw[i][1];
    let seg = Math.hypot(bx - ax, bz - az);
    while (acc + seg >= STEP) {
      const t = (STEP - acc) / seg;
      ax += (bx - ax) * t;
      az += (bz - az) * t;
      out.push(ax, az);
      seg = Math.hypot(bx - ax, bz - az);
      acc = 0;
    }
    acc += seg;
  }
  out.push(raw[raw.length - 1][0], raw[raw.length - 1][1]);
  return new Float32Array(out);
}

export interface Blocker { x: number; z: number; r: number; kind: string; scale: number; rot: number; tint: number }

const FIELD_RES = 2; // cells per world unit
const FIELD_R = 16; // world units of tracked path distance

/** Collision radius per decor kind, as a fraction of its scale (trunks, not canopies). */
const SOLID_R: Record<string, number> = {
  oak: 0.45, birch: 0.3, pine: 0.4, willow: 0.55, cherry: 0.4, bush: 0.55, rock: 0.85, bench: 0.75,
  maple: 0.35, bamboo: 0.6, mossy_stone: 0.8, stone_lantern: 0.45, fence_wood: 0.25, fence_rope: 0.15,
  // Walk over (or on) these.
  raked_gravel: 0, stepping_stone: 0, lotus: 0,
};

export class IslandWorld {
  place: PlaceDef;
  /** The place's paths (one for now), kept as an array like Lanternfall's roads. */
  roads: RoadPath[];
  halfW: number;
  halfH: number;
  extW: number;
  extH: number;
  waterLevel = 0;
  hasWater = true;
  pathWidth: number;
  blockers: Blocker[] = [];
  private fw: number;
  private fh: number;
  private dist: Float32Array;
  private heights: Float32Array;

  constructor(place: PlaceDef) {
    this.place = place;
    this.halfW = place.halfW;
    this.halfH = place.halfH;
    this.extW = place.halfW + place.margin;
    this.extH = place.halfH + place.margin;
    this.pathWidth = place.pathWidth;
    this.roads = [new RoadPath(resample(catmullRom(place.path)))];
    this.fw = Math.ceil(this.extW * 2 * FIELD_RES) + 1;
    this.fh = Math.ceil(this.extH * 2 * FIELD_RES) + 1;
    this.dist = new Float32Array(this.fw * this.fh).fill(FIELD_R);
    this.rasterizeRoads();
    this.heights = new Float32Array(this.fw * this.fh);
    for (let j = 0; j < this.fh; j++) {
      for (let i = 0; i < this.fw; i++) {
        const x = i / FIELD_RES - this.extW;
        const z = j / FIELD_RES - this.extH;
        this.heights[j * this.fw + i] = this.computeHeight(x, z, this.dist[j * this.fw + i]!);
      }
    }
    this.placeBlockers();
  }

  /** The seed, under the name Lanternfall's stage reads. */
  get seed() {
    return this.place.seed;
  }

  private rasterizeRoads() {
    const R = Math.ceil(FIELD_R * FIELD_RES);
    for (const road of this.roads) {
      for (let k = 0; k < road.count; k += 2) {
        const px = road.pts[k * 2], pz = road.pts[k * 2 + 1];
        const ci = Math.round((px + this.extW) * FIELD_RES);
        const cj = Math.round((pz + this.extH) * FIELD_RES);
        for (let j = Math.max(0, cj - R); j <= Math.min(this.fh - 1, cj + R); j++) {
          const z = j / FIELD_RES - this.extH;
          const row = j * this.fw;
          for (let i = Math.max(0, ci - R); i <= Math.min(this.fw - 1, ci + R); i++) {
            const x = i / FIELD_RES - this.extW;
            const d = Math.hypot(x - px, z - pz);
            if (d < this.dist[row + i]) this.dist[row + i] = d;
          }
        }
      }
    }
  }

  /** Distance from the rim of the island: >0 inside, <0 outside. */
  islandMask(x: number, z: number) {
    const seed = this.place.seed;
    const nx = x / this.extW;
    const nz = z / this.extH;
    const sq = Math.pow(Math.pow(Math.abs(nx), 3.4) + Math.pow(Math.abs(nz), 3.4), 1 / 3.4);
    const wob = (fbm(x * 0.05, z * 0.05, seed + 5, 3) - 0.5) * 0.16;
    return 1 - sq + wob - 0.03;
  }

  private computeHeight(x: number, z: number, d: number) {
    const s = this.place.seed;
    const amp = this.place.relief;
    const rolling = (fbm(x * 0.045, z * 0.045, s, 4) - 0.5) * 2 * amp * 2.2;
    const detail = (fbm(x * 0.19, z * 0.19, s + 3, 3) - 0.5) * 0.35 * amp;
    let h = 1.0 + rolling + detail;

    // The pond: a soft bowl with a ragged shoreline (Lanternfall's lakes, placed by hand).
    const p = this.place.pond;
    const pd = Math.hypot(x - p.x, z - p.z) / p.r + (fbm(x * 0.4, z * 0.4, s + 9, 2) - 0.5) * 0.3;
    h = lerp(h, -1.4, 1 - smoothstep(0.75, 1.15, pd));

    // The path is gently flattened so walking feels even.
    const pathH = 0.85 + (fbm(x * 0.03, z * 0.03, s + 2, 2) - 0.5) * 0.5;
    h = lerp(h, pathH, (1 - smoothstep(this.pathWidth * 0.7, this.pathWidth * 0.7 + 3.5, d)) * 0.8);

    // Hills ring the valley floor.
    const px = Math.abs(x) / this.halfW;
    const pz = Math.abs(z) / this.halfH;
    const outer = Math.max(px, pz);
    const rise = smoothstep(0.98, 1.42, outer);
    if (rise > 0) {
      const ridge = 1 - Math.abs(noise2(x * 0.07, z * 0.07, s + 21) * 2 - 1);
      const lump = fbm(x * 0.11, z * 0.11, s + 12, 4);
      const pathClear = smoothstep(2.5, 11, d);
      h += rise * this.place.hills * (0.45 + ridge * 0.75 + lump * 0.65) * pathClear;
    }

    // Cliffs at the island rim, falling into the clouds.
    const m = this.islandMask(x, z);
    const pathNear = 1 - smoothstep(1, 8, d);
    const rim = smoothstep(-0.02, 0.1, m + pathNear * 0.06);
    h = lerp(-32 - (1 - clamp(m + 1)) * 12, h, rim);
    if (m < 0.1) {
      // Rocky strata on the cliff faces.
      h += (noise2(x * 0.6, z * 0.6, s + 40) - 0.5) * 1.1 * (1 - rim);
    }
    return h;
  }

  private fieldAt(field: Float32Array, x: number, z: number) {
    const fx = clamp((x + this.extW) * FIELD_RES, 0, this.fw - 1.001);
    const fz = clamp((z + this.extH) * FIELD_RES, 0, this.fh - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const row = j * this.fw;
    const a = field[row + i], b = field[row + i + 1];
    const c = field[row + this.fw + i], d = field[row + this.fw + i + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  height(x: number, z: number) {
    return this.fieldAt(this.heights, x, z);
  }

  /** Distance to the path, in metres (capped at 16). */
  roadDistance(x: number, z: number) {
    return this.fieldAt(this.dist, x, z);
  }

  /** True where the caretaker can stand: on the valley floor, out of the water, off steep slopes. */
  walkable(x: number, z: number) {
    if (Math.abs(x) > this.halfW + 2 || Math.abs(z) > this.halfH + 2) return false;
    if (this.islandMask(x, z) < 0.12) return false;
    const h = this.height(x, z);
    if (h < this.waterLevel + 0.15) return false;
    const e = 0.5;
    const slope = Math.abs(this.height(x + e, z) - this.height(x - e, z)) + Math.abs(this.height(x, z + e) - this.height(x, z - e));
    return slope < 1.6;
  }

  /** Circles the caretaker can't walk through: trunks, rocks, props. */
  get solids(): { x: number; z: number; r: number }[] {
    return this.blockers.filter((b) => (SOLID_R[b.kind] ?? 0.4) > 0).map((b) => ({ x: b.x, z: b.z, r: (SOLID_R[b.kind] ?? 0.4) * b.scale }));
  }

  private keepClear(x: number, z: number, r: number) {
    const p = this.place;
    if (this.roadDistance(x, z) < this.pathWidth * 0.5 + 0.6 + r) return false;
    if (p.clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r)) return false;
    if (p.props.some((q) => Math.hypot(x - q.x, z - q.z) < 2 + r)) return false;
    // Gather nodes need room to walk around; build sites need their whole footprint and margin.
    if (p.nodes.some((q) => Math.hypot(x - q.x, z - q.z) < 2.6 + r)) return false;
    if (p.sites.some((q) => Math.hypot(x - q.x, z - q.z) < 5 + r)) return false;
    if (Math.hypot(x - p.pond.x, z - p.pond.z) < p.pond.r + 1 + r) return false;
    return true;
  }

  private placeBlockers() {
    const p = this.place;
    const rng = makeRng(p.seed * 977 + 13);
    const total = p.decor.kinds.reduce((s, [, w]) => s + w, 0);
    const pick = () => {
      let t = rng() * total;
      for (const [k, w] of p.decor.kinds) if ((t -= w) <= 0) return k;
      return p.decor.kinds[0]![0];
    };
    const placed: Blocker[] = [];
    const fits = (x: number, z: number, r: number) =>
      placed.every((o) => (o.x - x) ** 2 + (o.z - z) ** 2 >= ((o.r + r) * 0.78) ** 2);
    const clusterSeed = p.seed + 77;
    for (let t = 0; t < p.decor.count * 6 && placed.length < p.decor.count; t++) {
      const x = (rng() * 2 - 1) * this.extW;
      const z = (rng() * 2 - 1) * this.extH;
      if (this.islandMask(x, z) < 0.11) continue;
      if (this.height(x, z) < this.waterLevel + 0.3) continue;
      const kind = pick();
      const scale = 0.8 + rng() * 0.5;
      const r = (kind === 'bush' ? 0.6 : 1.05) * scale;
      if (!this.keepClear(x, z, r)) continue;
      // Groves follow a noise field; the open valley floor keeps fewer, scattered trees (plan 7.1).
      const inside = Math.abs(x) < this.halfW * 0.85 && Math.abs(z) < this.halfH * 0.85;
      const cluster = smoothstep(0.42, 0.6, fbm(x * 0.09, z * 0.09, clusterSeed, 3));
      let keep = lerp(0.5, cluster, p.decor.clustering);
      if (inside) keep *= 0.22;
      if (rng() > keep || !fits(x, z, r)) continue;
      placed.push({ x, z, r, kind, scale, rot: rng() * Math.PI * 2, tint: rng() });
    }
    for (let t = 0; t < p.rocks * 8 && placed.filter((b) => b.kind === 'rock').length < p.rocks; t++) {
      const x = (rng() * 2 - 1) * (this.halfW + 4);
      const z = (rng() * 2 - 1) * (this.halfH + 4);
      const scale = 0.35 + rng() * 0.6;
      const r = 0.9 * scale;
      if (this.islandMask(x, z) < 0.11 || this.height(x, z) < this.waterLevel + 0.2) continue;
      if (!this.keepClear(x, z, r) || !fits(x, z, r)) continue;
      placed.push({ x, z, r, kind: 'rock', scale, rot: rng() * 6.28, tint: rng() });
    }
    for (const q of p.props) {
      placed.push({ x: q.x, z: q.z, r: 1, kind: q.kind, scale: q.scale ?? 1, rot: q.rot ?? 0, tint: 0.5 });
    }
    this.blockers = placed;
  }
}
