// Building kits (plan 3.3, art decision point A5): a small library of procedural building parts
// (footings, decks, posts, beams, wall screens, roofs, lanterns, scaffolding) in two styles, and the
// shelter assembled from them one part per unit delivered. Each part settles into place; a ghost
// outline shows what is still missing; scaffolding stands around an unfinished building.
// Later buildings (gravel garden, hall, bell tower) are assembled from the same library.
// Painted+ (2026-11-10, look detail 'fine'): the temple kit gets a deck fascia and varied planks,
// capped footings, post brackets, a roof of shingled tile courses with rafter ends and barge boards;
// every part is shaded by the parts built before it (baked occlusion).
import * as THREE from 'three';
import type { AOOptions } from './ao';
import { fine, look, rich } from './look';
import { damp } from '../core/util';
import type { BuildingDef, KitStyleId } from '../data/buildings';
import { inked, Mats } from './materials';
import { MB, type Col } from './mb';

/** One part's models: solid (painted) and an optional glowing piece (lantern paper). */
export interface PartGeo {
  solid: THREE.BufferGeometry;
  glow?: THREE.BufferGeometry;
  /** Lanternfall+: a hanging piece that sways from `pivot` (a paper lantern), modelled with its pivot at the origin. */
  swing?: { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry; pivot: [number, number, number]; light: [number, number, number] };
}

interface Palette {
  wood: [number, number];
  woodDark: [number, number];
  plank: [number, number];
  stone: [number, number];
  roof: [number, number];
  wall: [number, number];
  rope: number;
}

const PAL: Record<KitStyleId, Palette> = {
  temple: {
    wood: [0x6e5640, 0x9a7a58], woodDark: [0x4e3a2a, 0x6e5440], plank: [0xb89a6e, 0xd9c39d],
    stone: [0x8a8878, 0xb0ad9c], roof: [0x55605f, 0x7c8886], wall: [0xeee2c8, 0xf6eedc], rope: 0xc8b07a,
  },
  timber: {
    wood: [0x5e4632, 0x8a6a4a], woodDark: [0x4a3626, 0x6a5038], plank: [0x9a7a55, 0xc4a678],
    stone: [0x7d7b6e, 0x9d9c8b], roof: [0xa88a52, 0xd8c088], wall: [0xb8a06a, 0xd8c690], rope: 0xc8b07a,
  },
};

// ---------------------------------------------------------------------------------------------
// The part library. Positions are in the building's local space (+z faces the camera's side).

/** A post from the deck up: square cedar (temple) or a round log lashed near the top (timber). */
function post(m: MB, s: KitStyleId, x: number, z: number, y0: number, h: number) {
  const P = PAL[s];
  m.setMark('wood');
  if (s === 'temple') {
    m.box(0.17, h, 0.17, P.wood, { p: [x, y0 + h / 2, z], wobble: 0.004 });
    m.box(0.22, 0.06, 0.22, P.woodDark, { p: [x, y0 + 0.03, z] });
    if (fine()) {
      // A bearing block at the top and a dark band near the foot.
      m.box(0.26, 0.09, 0.26, P.woodDark, { p: [x, y0 + h - 0.02, z] });
      m.box(0.2, 0.05, 0.2, P.wood, { p: [x, y0 + h - 0.1, z] });
      m.box(0.185, 0.04, 0.185, P.woodDark, { p: [x, y0 + 0.3, z] });
    }
  } else {
    m.cyl(0.085, 0.105, h, P.wood, { p: [x, y0 + h / 2, z], wobble: 0.01, r: [0.015, 0, -0.01], mark: 'bark' }, 8, 2);
    m.torus(0.1, 0.022, P.rope, { p: [x, y0 + h - 0.22, z], r: [Math.PI / 2, 0, 0] }, 5, 10);
    m.torus(0.1, 0.022, P.rope, { p: [x, y0 + h - 0.32, z], r: [Math.PI / 2, 0, 0] }, 5, 10);
  }
  m.setMark('none');
}

/** A horizontal beam between two points at height y. */
function beam(m: MB, s: KitStyleId, ax: number, az: number, bx: number, bz: number, y: number, thick = 1) {
  const P = PAL[s];
  const len = Math.hypot(bx - ax, bz - az);
  const ry = Math.atan2(bx - ax, bz - az);
  if (s === 'temple') m.box(0.13 * thick, 0.16 * thick, len, P.woodDark, { p: [(ax + bx) / 2, y, (az + bz) / 2], r: [0, ry, 0], mark: 'wood' });
  else m.cyl(0.07 * thick, 0.07 * thick, len, P.wood, { p: [(ax + bx) / 2, y, (az + bz) / 2], r: [Math.PI / 2, ry, 0], wobble: 0.006, mark: 'wood' }, 7);
}

/** Footings and a floor: stone blocks + planks (temple) or stones + logs (timber). */
function floor(m: MB, s: KitStyleId, w: number, d: number, y: number) {
  const P = PAL[s];
  m.setMark('wood');
  for (const fx of [-1, 0, 1]) for (const fz of [-1, 1]) {
    if (s === 'temple') m.box(0.32, y, 0.32, P.stone, { p: [fx * (w / 2 - 0.2), y / 2, fz * (d / 2 - 0.2)], wobble: 0.02, mark: 'stone' });
    else m.ico(0.24, P.stone, { p: [fx * (w / 2 - 0.2), y * 0.45, fz * (d / 2 - 0.2)], s: [1.1, y * 3, 1], wobble: 0.03, mark: 'stone' }, 1);
  }
  if (s === 'temple' && fine()) {
    // Capped footings, a fascia board around the deck, and planks that each take a slightly different tone.
    for (const fx of [-1, 0, 1]) for (const fz of [-1, 1]) {
      m.box(0.38, 0.05, 0.38, P.stone, { p: [fx * (w / 2 - 0.2), 0.02, fz * (d / 2 - 0.2)], wobble: 0.01, mark: 'stone' });
      m.box(0.26, 0.04, 0.26, P.stone, { p: [fx * (w / 2 - 0.2), y + 0.01, fz * (d / 2 - 0.2)], mark: 'stone' });
    }
    m.box(w, 0.08, d, P.woodDark, { p: [0, y + 0.04, 0] });
    for (const side of [-1, 1]) {
      m.box(w + 0.06, 0.12, 0.04, P.woodDark, { p: [0, y + 0.06, side * (d / 2 + 0.02)] });
      m.box(0.04, 0.12, d + 0.06, P.woodDark, { p: [side * (w / 2 + 0.02), y + 0.06, 0] });
    }
    const n = 12;
    const tones: [number, number][] = [P.plank, [0xb0926a, 0xd2bb94], [0xbfa173, 0xdfc9a3]];
    for (let i = 0; i < n; i++) m.box(w / n - 0.02, 0.05, d - 0.02, tones[(i * 7) % 3]!, { p: [-w / 2 + (i + 0.5) * (w / n), y + 0.105 + ((i * 5) % 3) * 0.004, 0], wobble: 0.002 });
    m.box(1.0, 0.16, 0.36, P.stone, { p: [0, 0.08, d / 2 + 0.24], wobble: 0.012, mark: 'stone' });
    m.box(0.9, 0.16, 0.3, P.stone, { p: [0, 0.24, d / 2 + 0.06], wobble: 0.012, mark: 'stone' });
  } else if (s === 'temple') {
    m.box(w, 0.08, d, P.woodDark, { p: [0, y + 0.04, 0] });
    const n = 8;
    for (let i = 0; i < n; i++) m.box(w / n - 0.025, 0.06, d, P.plank, { p: [-w / 2 + (i + 0.5) * (w / n), y + 0.11, 0], wobble: 0.003 });
    // Two stone steps up to the front.
    m.box(1.0, 0.16, 0.36, P.stone, { p: [0, 0.08, d / 2 + 0.24], wobble: 0.012 });
    m.box(0.9, 0.16, 0.3, P.stone, { p: [0, 0.24, d / 2 + 0.06], wobble: 0.012 });
  } else if (fine()) {
    timberFloor(m, w, d, y);
  } else {
    const n = 9;
    for (let i = 0; i < n; i++) m.cyl(0.13, 0.13, w + 0.1, P.plank, { p: [0, y + 0.06, -d / 2 + (i + 0.5) * (d / n)], r: [0, 0, Math.PI / 2], wobble: 0.01 }, 7);
    m.ico(0.2, P.stone, { p: [0.1, 0.1, d / 2 + 0.3], s: [1.6, 0.6, 1.1], wobble: 0.03, mark: 'stone' }, 1);
  }
  m.setMark('none');
}

/** Half of a wall screen between two x positions at depth z: shoji (temple) or woven reeds (timber). */
function screen(m: MB, s: KitStyleId, x0: number, x1: number, z: number, y0: number, h: number) {
  const P = PAL[s];
  const w = x1 - x0, cx = (x0 + x1) / 2;
  if (s === 'temple') {
    m.box(w, h, 0.04, P.wall, { p: [cx, y0 + h / 2, z] });
    const cols = Math.max(2, Math.round(w / 0.32));
    for (let i = 0; i <= cols; i++) m.box(0.035, h, 0.06, P.woodDark, { p: [x0 + (i / cols) * w, y0 + h / 2, z] });
    for (let j = 0; j <= 4; j++) m.box(w, 0.035, 0.06, P.woodDark, { p: [cx, y0 + (j / 4) * h, z] });
  } else {
    const n = Math.round(w / 0.07);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * (w / n);
      m.cyl(0.03, 0.034, h, i % 3 ? P.wall : [P.wall[0], 0xe6d6a0], { p: [x, y0 + h / 2, z + (i % 2 ? 0.015 : -0.015)] }, 5);
    }
    for (const yy of [0.25, 0.6, 0.9]) m.box(w, 0.04, 0.08, P.rope, { p: [cx, y0 + h * yy, z] });
  }
}

// --- Timber detail pass (Phase 3, owner: "as long as we can make roofs more detailed"): layered thatch
// bundles with a ragged eave, a bound ridge with crossed, lashed poles and a little moss, rafter poles
// and purlins under the eaves, rope lashings at the joints and a firmer log floor. Built in Lanternfall+.

const THATCH: [number, number][] = [[0x9a7a44, 0xd2b67a], [0x8e7040, 0xc8aa6c], [0xa48650, 0xdcc488]];
const THATCH_DARK: [number, number] = [0x6e5530, 0x9a7a48];
const POLE: [number, number] = [0x5a4430, 0x846246];
const MOSS: [number, number] = [0x4f6f34, 0x7d9a4c];

/** A cheap, repeatable "random" in [0, 1) from two integers (models must not change between loads). */
const hash = (a: number, b: number) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

/** One side of a thatched gable: rafters and purlins underneath, then courses of straw bundles, then a ragged eave. */
function thatchSide(m: MB, side: number, w: number, half: number, eave: number, rise: number) {
  const P = PAL.timber;
  const ang = Math.atan2(rise, half);
  const slope = Math.hypot(half, rise);
  const ridge = eave + rise;
  const ny = Math.cos(ang), nz = side * Math.sin(ang); // outward normal of this slope
  const at = (u: number, lift: number): [number, number] => [ridge - rise * u + ny * lift, side * half * u + nz * lift];
  const down: [number, number, number] = [Math.PI / 2 + side * ang, 0, 0];
  // Rafter poles down the slope, poking out past the eave; purlins across them.
  const nr = Math.max(4, Math.round((w + 0.4) / 0.55));
  for (let i = 0; i < nr; i++) {
    const x = -(w + 0.3) / 2 + (i + 0.5) * ((w + 0.3) / nr);
    const [y, z] = at(0.55, -0.16);
    m.cyl(0.04, 0.045, slope * 1.12, POLE, { p: [x, y, z], r: down, wobble: 0.004, mark: 'bark' }, 6);
  }
  for (const u of [0.25, 0.62, 0.92]) {
    const [y, z] = at(u, -0.08);
    m.cyl(0.045, 0.045, w + 0.55, POLE, { p: [0, y, z], r: [0, 0, Math.PI / 2], wobble: 0.004, mark: 'bark' }, 6);
  }
  // Barge poles along both gable edges.
  for (const sx of [-1, 1]) {
    const [y, z] = at(0.5, 0.02);
    m.cyl(0.05, 0.05, slope + 0.2, POLE, { p: [sx * (w / 2 + 0.33), y, z], r: down, mark: 'bark' }, 6);
  }
  // Courses of bundles from the ridge down: each bundle a squashed roll of straw laid down the slope,
  // every course staggered and sitting a little prouder than the one above, so the eave reads thick.
  const courses = 5;
  const seg = slope / courses;
  const bw = 0.24;
  const nb = Math.ceil((w + 0.62) / bw);
  for (let j = 0; j < courses; j++) {
    const u = (j + 0.55) / courses;
    const lift = 0.06 + j * 0.022;
    const off = (j % 2) * 0.5;
    for (let i = 0; i < nb + (j % 2 ? 0 : 1); i++) {
      const x = -(w + 0.62) / 2 + (i + off) * bw;
      if (Math.abs(x) > (w + 0.62) / 2 + 0.02) continue;
      const jitter = hash(i, j * 7 + (side > 0 ? 1 : 3));
      const [y, z] = at(u, lift + jitter * 0.025);
      const len = seg * (1.45 + jitter * 0.12);
      m.cyl(bw * 0.58, bw * 0.5, len, THATCH[(i + j) % 3]!, { p: [x, y, z], r: [down[0] + (jitter - 0.5) * 0.06, 0, (jitter - 0.5) * 0.05], s: [1, 1, 0.5], wobble: 0.025, wobbleFreq: 6 }, 6);
    }
    // A thin binding rod (a pole lashed over each course) on the upper courses.
    if (j < courses - 1) {
      const [y, z] = at(u - 0.3 / courses, lift + 0.07);
      m.cyl(0.022, 0.022, w + 0.55, P.rope, { p: [0, y, z], r: [0, 0, Math.PI / 2] }, 5);
    }
  }
  // The ragged eave: straw ends of uneven length, a darker cut underneath.
  const [ey, ez] = at(1.03, 0.08 + (courses - 1) * 0.022);
  m.box(w + 0.66, 0.1, 0.16, THATCH_DARK, { p: [0, ey - 0.06, ez], r: [side * ang, 0, 0], wobble: 0.03, wobbleFreq: 5 });
  const nf = Math.round((w + 0.6) / 0.075);
  for (let i = 0; i < nf; i++) {
    const x = -(w + 0.6) / 2 + (i + 0.5) * ((w + 0.6) / nf);
    const h = hash(i, side > 0 ? 11 : 17);
    const len = 0.12 + h * 0.16;
    m.cone(0.045, len, [0xb89a5e, 0x8a6c3e], { p: [x, ey - len * 0.35, ez + side * 0.04], r: [Math.PI + side * (0.35 + h * 0.2), 0, (h - 0.5) * 0.3] }, 4);
  }
}

/** The ridge: a thick bound roll of straw, crossed poles lashed in pairs along it, and a little moss. */
function thatchRidge(m: MB, w: number, ridge: number) {
  const P = PAL.timber;
  m.cyl(0.21, 0.21, w + 0.85, [0x8a6c3c, 0xc4a468], { p: [0, ridge + 0.15, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.85], wobble: 0.03, wobbleFreq: 4 }, 10);
  const nb = Math.max(4, Math.round(w / 0.42));
  for (let i = 0; i <= nb; i++) {
    const x = -(w + 0.6) / 2 + i * ((w + 0.6) / nb);
    m.torus(0.215, 0.026, P.rope, { p: [x, ridge + 0.15, 0], r: [0, Math.PI / 2, 0], s: [1, 0.86, 1] }, 5, 12);
  }
  const pairs = Math.max(3, Math.round(w / 0.9));
  for (let i = 0; i < pairs; i++) {
    const x = -(w + 0.3) / 2 + (i + 0.5) * ((w + 0.3) / pairs);
    for (const tilt of [-0.62, 0.62]) m.cyl(0.035, 0.04, 0.95, POLE, { p: [x, ridge + 0.36, 0], r: [tilt, 0, 0], mark: 'bark' }, 5);
    m.torus(0.06, 0.02, P.rope, { p: [x, ridge + 0.36, 0], r: [0, Math.PI / 2, 0] }, 4, 8);
  }
  // A rider pole along the top, through the crossings.
  m.cyl(0.04, 0.04, w + 0.4, POLE, { p: [0, ridge + 0.45, 0], r: [0, 0, Math.PI / 2], mark: 'bark' }, 6);
  for (let i = 0; i < 5; i++) {
    const h = hash(i, 29);
    m.ico(0.12 + h * 0.08, MOSS, { p: [(h - 0.5) * w * 0.9, ridge + 0.28, (hash(i, 31) - 0.5) * 0.25], s: [1.6, 0.4, 1], wobble: 0.03 }, 1);
  }
}

/** A firmer log floor: sleepers on the stones, close-laid logs with cut ends, and lashed edge poles. */
function timberFloor(m: MB, w: number, d: number, y: number) {
  const P = PAL.timber;
  for (const sx of [-1, 0, 1]) m.cyl(0.11, 0.12, d + 0.2, POLE, { p: [sx * (w / 2 - 0.2), y - 0.09, 0], r: [Math.PI / 2, 0, 0], wobble: 0.008, mark: 'bark' }, 7);
  const n = Math.max(6, Math.round(d / 0.24));
  for (let i = 0; i < n; i++) {
    const z = -d / 2 + (i + 0.5) * (d / n);
    const h = hash(i, 41);
    const r = d / n / 2 + 0.008;
    const len = w + 0.08 + (h - 0.5) * 0.16;
    m.cyl(r, r, len, h > 0.5 ? P.plank : [0x8e6f4c, 0xbc9c6e], { p: [(h - 0.5) * 0.06, y + 0.06, z], r: [0, 0, Math.PI / 2], wobble: 0.006, mark: 'wood' }, 8);
    // Pale cut ends with a dark ring.
    for (const sx of [-1, 1]) m.cyl(r * 0.86, r * 0.86, 0.02, [0xd8c08c, 0xe6d2a0], { p: [sx * (len / 2 + 0.005) + (h - 0.5) * 0.06, y + 0.06, z], r: [0, 0, Math.PI / 2] }, 8);
  }
  for (const sz of [-1, 1]) {
    m.cyl(0.06, 0.06, w + 0.3, POLE, { p: [0, y + 0.17, sz * (d / 2 - 0.02)], r: [0, 0, Math.PI / 2], mark: 'bark' }, 6);
    for (const sx of [-1, 1]) m.torus(0.08, 0.02, P.rope, { p: [sx * (w / 2 - 0.2), y + 0.15, sz * (d / 2 - 0.02)], r: [0, Math.PI / 2, 0] }, 4, 9);
  }
  // A flat step stone at the front.
  m.ico(0.22, P.stone, { p: [0.1, 0.1, d / 2 + 0.32], s: [1.7, 0.55, 1.15], wobble: 0.03, mark: 'stone' }, 2);
}

/** A gabled roof over a w x d footprint: grey tiles in rows with a ridge (temple) or layered thatch (timber). */
function roof(m: MB, s: KitStyleId, w: number, d: number, eave: number, rise: number): void {
  const P = PAL[s];
  const half = d / 2 + 0.45;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  const ridge = eave + rise;
  for (const side of [-1, 1]) {
    const cz = side * half / 2, cy = eave + rise / 2;
    if (s === 'temple' && fine()) {
      // A board under the tiles, then rounded tiles laid in courses: each tile is a little wider at its
      // lower end, so every course casts a soft step onto the next.
      m.box(w + 0.7, 0.06, slope, P.woodDark, { p: [0, cy - 0.06, cz], r: [side * ang, 0, 0], mark: 'wood' });
      const cols = 12, courses = 6;
      const seg = slope / courses;
      for (let i = 0; i < cols; i++) {
        const x = -(w + 0.6) / 2 + (i + 0.5) * ((w + 0.6) / cols);
        for (let j = 0; j < courses; j++) {
          const u = (j + 0.5) / courses;
          const big = 0.118, small = 0.094;
          // +y of the cylinder points down the slope on the front side and up it on the back.
          const [rt, rb] = side > 0 ? [big, small] : [small, big];
          const tone: [number, number] = (i + j) % 4 === 0 ? [0x5b6665, 0x84908e] : P.roof;
          m.cyl(rt, rb, seg * 1.04, tone, { p: [x, ridge - rise * u + 0.05, side * half * u], r: [Math.PI / 2 + side * ang, 0, 0], s: [1, 1, 0.55] }, 8);
        }
      }
      // Rafter ends under the eave, and barge boards along the gable ends.
      const nr = 10;
      for (let i = 0; i < nr; i++) {
        const x = -(w + 0.4) / 2 + (i + 0.5) * ((w + 0.4) / nr);
        m.box(0.07, 0.08, 0.3, P.wood, { p: [x, eave - 0.1, side * (half - 0.12)], r: [side * ang, 0, 0], mark: 'wood' });
      }
      for (const sx of [-1, 1]) m.box(0.05, 0.2, slope + 0.1, P.woodDark, { p: [sx * (w / 2 + 0.38), cy - 0.02, cz], r: [side * ang, 0, 0], mark: 'wood' });
      m.box(w + 0.8, 0.1, 0.18, P.roof, { p: [0, eave - 0.02, side * (half + 0.02)], r: [-side * 0.25, 0, 0] });
    } else if (s === 'temple') {
      // A board under the tiles, then rows of rounded tiles running down the slope.
      m.box(w + 0.7, 0.06, slope, P.woodDark, { p: [0, cy - 0.06, cz], r: [side * ang, 0, 0] });
      const rows = 11;
      for (let i = 0; i < rows; i++) {
        const x = -(w + 0.6) / 2 + (i + 0.5) * ((w + 0.6) / rows);
        m.cyl(0.11, 0.11, slope, P.roof, { p: [x, cy + 0.04, cz], r: [Math.PI / 2 + side * ang, 0, 0], s: [1, 1, 0.55] }, 7);
      }
      // A gentle upturn at the eave: an end row of tiles.
      m.box(w + 0.8, 0.1, 0.18, P.roof, { p: [0, eave - 0.02, side * (half + 0.02)], r: [-side * 0.25, 0, 0] });
    } else if (fine()) {
      thatchSide(m, side, w, half, eave, rise);
    } else {
      // Thatch: three overlapping thick layers, the lowest overhanging most.
      for (let k = 0; k < 3; k++) {
        const t = k / 3;
        const len = slope * (1 - t * 0.28);
        const zz = side * (half - len * Math.cos(ang) / 2 - t * 0.02);
        const yy = ridge - (Math.abs(zz) / half) * rise + 0.08 + k * 0.05;
        m.box(w + 0.6 - k * 0.1, 0.2, len, k === 0 ? P.roof : [P.roof[0], 0xe6cc94], { p: [0, yy, zz], r: [side * ang, 0, 0], wobble: 0.07, wobbleFreq: 2.6 });
      }
      // A ragged straw fringe along the eave.
      const n = 26;
      for (let i = 0; i < n; i++) {
        const x = -(w + 0.55) / 2 + (i + 0.5) * ((w + 0.55) / n);
        const len = 0.22 + ((i * 7) % 5) * 0.03;
        m.cone(0.07, len, [0xc8a868, 0x9a7a48], { p: [x, eave - 0.02 - len / 2 + 0.08, side * (half - 0.02)], r: [Math.PI + side * 0.35, 0, 0] }, 4);
      }
    }
  }
  if (s === 'temple') {
    m.box(w + 0.9, 0.16, 0.22, P.roof, { p: [0, ridge + 0.1, 0] });
    if (fine()) {
      // A rounded cap along the ridge and taller end tiles that flare outward.
      m.cyl(0.13, 0.13, w + 0.9, P.roof, { p: [0, ridge + 0.2, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.8] }, 10);
      for (const sx of [-1, 1]) m.box(0.22, 0.4, 0.34, [0x4a5453, 0x6c7876], { p: [sx * (w / 2 + 0.44), ridge + 0.22, 0], r: [0, 0, sx * -0.35] });
    } else for (const sx of [-1, 1]) m.box(0.2, 0.28, 0.3, P.roof, { p: [sx * (w / 2 + 0.42), ridge + 0.16, 0], r: [0, 0, sx * -0.3] });
  } else if (fine()) {
    thatchRidge(m, w, ridge);
  } else {
    m.cyl(0.16, 0.16, w + 0.8, [P.roof[0], 0xc8a868], { p: [0, ridge + 0.14, 0], r: [0, 0, Math.PI / 2], wobble: 0.02 }, 8);
    for (const sx of [-1, 1]) for (const tilt of [-0.55, 0.55]) {
      m.cyl(0.04, 0.04, 0.9, P.wood, { p: [sx * (w / 2 + 0.2), ridge + 0.22, 0], r: [tilt, 0, 0] }, 5);
    }
    for (let i = -2; i <= 2; i++) m.torus(0.17, 0.02, P.rope, { p: [i * (w / 5), ridge + 0.14, 0], r: [0, Math.PI / 2, 0] }, 4, 10);
  }
}

/** A hanging paper lantern: solid frame/cap + glowing paper. */
function lantern(m: MB, g: MB, x: number, y: number, z: number) {
  m.cyl(0.015, 0.015, 0.3, 0x3a2e28, { p: [x, y + 0.42, z] }, 4);
  m.cyl(0.13, 0.15, 0.05, 0x3a2e28, { p: [x, y + 0.27, z] }, 10);
  m.cyl(0.15, 0.13, 0.05, 0x3a2e28, { p: [x, y - 0.27, z] }, 10);
  g.lathe([[0.001, -0.25], [0.12, -0.24], [0.2, -0.1], [0.21, 0.05], [0.17, 0.2], [0.11, 0.25], [0.001, 0.26]], [0xf0a050, 0xffd090], { p: [x, y, z], gain: 1.6 }, 12);
}

/** A noren curtain hung from a lintel: two lavender panels with a pale lotus. */
function noren(m: MB, x: number, y: number, z: number, w: number) {
  const panel: Col = [0x7c6c94, 0x968ab0];
  for (const side of [-1, 1]) m.box(w / 2 - 0.03, 0.62, 0.025, panel, { p: [x + side * w / 4, y - 0.31, z] });
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.42;
    m.sphere(0.09, 0xe8dcd0, { p: [x + Math.sin(a) * 0.13, y - 0.36 + Math.cos(a) * 0.08, z + 0.02], s: [0.55, 1.2, 0.2], r: [0, 0, -a] }, 6, 5);
  }
}

// ---------------------------------------------------------------------------------------------
// The shelter: 2.8 x 2.4 m, four posts, back screen, a front lintel, a gabled roof. Faces +z.

type KitBuilder = Record<string, (s: KitStyleId, ao: AOOptions) => PartGeo>;
const W = 2.8, D = 2.4, FLOOR = 0.42;
const PX = 1.2, PZ = 1.0;

const shelterKit: KitBuilder = {
  deck: (s, ao) => { const m = new MB(); floor(m, s, W, D, FLOOR); return { solid: m.build(ao) }; },
  post_back_left: (s, ao) => {
    const m = new MB();
    post(m, s, -PX, -PZ, FLOOR + 0.14, 2.0);
    screen(m, s, -PX + 0.08, 0, -PZ, FLOOR + 0.14, 1.55);
    return { solid: m.build(ao) };
  },
  post_back_right: (s, ao) => {
    const m = new MB();
    post(m, s, PX, -PZ, FLOOR + 0.14, 2.0);
    screen(m, s, 0, PX - 0.08, -PZ, FLOOR + 0.14, 1.55);
    beam(m, s, -PX - 0.2, -PZ, PX + 0.2, -PZ, FLOOR + 2.12);
    return { solid: m.build(ao) };
  },
  post_front_left: (s, ao) => {
    const m = new MB();
    post(m, s, -PX, PZ, FLOOR + 0.14, 1.85);
    beam(m, s, -PX, -PZ - 0.15, -PX, PZ + 0.15, FLOOR + 1.95, 0.9);
    if (s === 'timber') m.cyl(0.04, 0.04, 1.3, PAL.timber.wood, { p: [-PX, FLOOR + 1.4, PZ - 0.45], r: [0.85, 0, 0] }, 5);
    return { solid: m.build(ao) };
  },
  post_front_right: (s, ao) => {
    const m = new MB();
    const g = new MB();
    post(m, s, PX, PZ, FLOOR + 0.14, 1.85);
    beam(m, s, PX, -PZ - 0.15, PX, PZ + 0.15, FLOOR + 1.95, 0.9);
    beam(m, s, -PX - 0.2, PZ, PX + 0.2, PZ, FLOOR + 1.98);
    if (s === 'temple') noren(m, 0, FLOOR + 1.9, PZ + 0.08, 1.3);
    else m.cyl(0.04, 0.04, 1.3, PAL.timber.wood, { p: [PX, FLOOR + 1.4, PZ - 0.45], r: [0.85, 0, 0] }, 5);
    return g.empty ? { solid: m.build(ao) } : { solid: m.build(ao), glow: g.build({ off: true }) };
  },
  roof: (s, ao) => {
    const m = new MB();
    const g = new MB();
    roof(m, s, W, D, FLOOR + 2.1, s === 'temple' ? 0.95 : 1.15);
    if (s === 'temple' && rich()) {
      // Lanternfall+: the lantern hangs from its cord and sways; modelled around the top of the cord.
      const lm = new MB(); const lg = new MB();
      lantern(lm, lg, 0, -0.57, 0);
      const solid = m.build(ao);
      return { solid, swing: { solid: lm.build({ off: true }), glow: lg.build({ off: true }), pivot: [PX + 0.3, FLOOR + 1.6 + 0.57, PZ + 0.35], light: [0, -0.57, 0] } };
    }
    if (s === 'temple') lantern(m, g, PX + 0.3, FLOOR + 1.6, PZ + 0.35);
    return g.empty ? { solid: m.build(ao) } : { solid: m.build(ao), glow: g.build({ off: true }) };
  },
};

const KITS: Record<string, KitBuilder> = { shelter_kit: shelterKit };

/** Every part id each kit can draw (the data test checks buildings only use these). */
export const KIT_PARTS: Record<string, string[]> = Object.fromEntries(Object.entries(KITS).map(([k, v]) => [k, Object.keys(v)]));

const geoCache = new Map<string, PartGeo>();
export function partGeo(kit: string, part: string, style: KitStyleId = 'temple'): PartGeo {
  const key = (p: string) => `${look().id}/${style}/${kit}/${p}`;
  let g = geoCache.get(key(part));
  if (!g) {
    // Build the whole kit in order, so each part is shaded by the parts that stand before it
    // (posts by the deck, the roof by the posts) when the look bakes occlusion.
    const occluders: THREE.BufferGeometry[] = [];
    for (const [id, build] of Object.entries(KITS[kit]!)) {
      const pg = geoCache.get(key(id)) ?? build(style, { ground: true, occluders: [...occluders] });
      pg.solid.computeBoundingBox();
      geoCache.set(key(id), pg);
      occluders.push(pg.solid);
    }
    g = geoCache.get(key(part))!;
  }
  return g;
}

/** Scaffolding: squared lumber with a ladder (temple) or poles lashed with rope (timber). */
function scaffoldGeo(s: KitStyleId): THREE.BufferGeometry {
  const m = new MB().setMark('wood');
  const P = PAL[s];
  const ex = 1.7, ez = 1.4;
  const pole = (x: number, z: number, h: number) => s === 'temple'
    ? m.box(0.09, h, 0.09, P.plank, { p: [x, h / 2, z], r: [0.02, 0, -0.015] })
    : m.cyl(0.045, 0.055, h, [0x8a9a5a, 0xc8c08a], { p: [x, h / 2, z], r: [0.03, 0, -0.02] }, 5);
  const bar = (ax: number, az: number, bx: number, bz: number, y: number) => {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    if (s === 'temple') m.box(0.07, 0.07, len, P.plank, { p: [(ax + bx) / 2, y, (az + bz) / 2], r: [0, ry, 0] });
    else m.cyl(0.035, 0.035, len, [0x8a9a5a, 0xc8c08a], { p: [(ax + bx) / 2, y, (az + bz) / 2], r: [Math.PI / 2, ry, 0] }, 5);
  };
  pole(-ex, ez, 3.2); pole(ex, ez, 3.2); pole(-ex, -ez, 3.4); pole(ex, -ez, 3.4);
  for (const y of [1.3, 2.5]) {
    bar(-ex, ez, ex, ez, y); bar(-ex, -ez, ex, -ez, y + 0.1);
    bar(-ex, -ez, -ex, ez, y + 0.2); bar(ex, -ez, ex, ez, y + 0.2);
  }
  if (s === 'temple') {
    // A ladder leaning on the front right.
    for (const sx of [-0.2, 0.2]) m.box(0.06, 2.6, 0.06, P.plank, { p: [ex + 0.35 + sx, 1.25, ez + 0.3], r: [0.2, 0, 0] });
    for (let i = 0; i < 7; i++) m.box(0.42, 0.04, 0.05, P.plank, { p: [ex + 0.35, 0.3 + i * 0.34, ez + 0.3 - (0.3 + i * 0.34) * 0.2 + 0.25] });
    // A plank walkway on the back bars.
    m.box(2 * ex, 0.05, 0.3, P.plank, { p: [0, 2.64, -ez + 0.1] });
  } else {
    for (const [x, z] of [[-ex, ez], [ex, ez], [-ex, -ez], [ex, -ez]] as const) for (const y of [1.3, 2.5]) m.torus(0.07, 0.025, P.rope, { p: [x, y + 0.1, z], r: [Math.PI / 2, 0, 0] }, 5, 10);
    // Diagonal braces.
    m.cyl(0.03, 0.03, 3.6, [0x8a9a5a, 0xc8c08a], { p: [0, 1.9, -ez], r: [0, 0, 0.62] }, 5);
  }
  return m.build({ ground: true });
}

const MARKER_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha, uTime, uActive;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;
    float ring = smoothstep(0.78, 0.9, r) * (1.0 - smoothstep(0.93, 1.0, r));
    // Soft dashes turning slowly, like a rope laid on the ground.
    float a = atan(vUv.y - 0.5, vUv.x - 0.5);
    float dash = 0.65 + 0.35 * smoothstep(-0.2, 0.4, sin(a * 18.0 + uTime * 0.4));
    float fill = (1.0 - r) * 0.18 * uActive;
    gl_FragColor = vec4(uColor, (ring * dash * (0.55 + 0.45 * uActive) + fill) * uAlpha);
  }
`;

interface ShownPart {
  meshes: THREE.Object3D[];
  ghost: THREE.Mesh;
  built: boolean;
  /** Seconds left before the part starts settling (waits for the flying item to land). */
  delay: number;
  /** 0 → 1 settle animation; 1 = in place. */
  t: number;
}

export class BuildingView {
  readonly root = new THREE.Group();
  private parts: ShownPart[] = [];
  private scaffold: THREE.Mesh;
  private scaffoldS = 0;
  private marker: THREE.Mesh;
  private markerMat: THREE.ShaderMaterial;
  private markerAlpha = 1;
  private ghostMat: THREE.MeshBasicMaterial;
  /** Lanternfall+: hanging pieces that sway, and the part they belong to. */
  private swingers: { pivot: THREE.Group; part: number; light: THREE.Vector3; phase: number }[] = [];
  active = false;

  /**
   * Lanternfall+: where this building's hanging lanterns are (world space) and how much they shine
   * (0 until their part has settled in). Writes up to `out.length` entries; returns how many.
   */
  lamps(out: THREE.Vector4[], from = 0): number {
    let n = 0;
    for (const s of this.swingers) {
      const o = out[from + n];
      if (!o) break;
      const p = this.parts[s.part]!;
      const shown = p.built && p.delay <= 0 ? p.t : 0;
      const v = s.pivot.localToWorld(s.light.clone());
      o.set(v.x, v.y, v.z, shown);
      n++;
    }
    return n;
  }

  constructor(readonly def: BuildingDef, x: number, z: number, rot: number, heightAt: (x: number, z: number) => number, built: boolean[], readonly style: KitStyleId = 'temple') {
    const y = heightAt(x, z);
    this.root.position.set(x, y - 0.05, z);
    this.root.rotation.y = rot;
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.22, depthWrite: false });
    def.parts.forEach((p, i) => {
      const geo = partGeo(def.kit, p.id, style);
      const mesh = inked(new THREE.Mesh(geo.solid, Mats.std), 'building');
      mesh.castShadow = mesh.receiveShadow = true;
      const meshes: THREE.Object3D[] = [mesh];
      if (geo.glow) meshes.push(new THREE.Mesh(geo.glow, Mats.glow));
      if (geo.swing) {
        // The settle animation moves `holder`; `pivot` hangs inside it and sways.
        const holder = new THREE.Group();
        const pivot = new THREE.Group();
        pivot.position.set(...geo.swing.pivot);
        const lm = inked(new THREE.Mesh(geo.swing.solid, Mats.std), 'building');
        lm.castShadow = true;
        pivot.add(lm, new THREE.Mesh(geo.swing.glow, Mats.glow));
        holder.add(pivot);
        meshes.push(holder);
        this.swingers.push({ pivot, part: i, light: new THREE.Vector3(...geo.swing.light), phase: i * 1.7 });
      }
      const ghost = new THREE.Mesh(geo.solid, this.ghostMat);
      ghost.renderOrder = 4;
      this.root.add(...meshes, ghost);
      this.parts.push({ meshes, ghost, built: !!built[i], delay: 0, t: built[i] ? 1 : 0 });
    });
    this.scaffold = inked(new THREE.Mesh(scaffoldGeo(style), Mats.std), 'building');
    this.scaffold.castShadow = true;
    this.root.add(this.scaffold);
    const done = built.every(Boolean);
    this.scaffoldS = built.some(Boolean) && !done ? 1 : 0;
    this.markerAlpha = done ? 0 : 1;

    // A ground marker that follows the terrain: a disc of vertices lifted to the ground height.
    const r = def.siteRadius;
    const geo = new THREE.CircleGeometry(r, 48, 0, Math.PI * 2);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), lz = pos.getZ(i);
      const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
      pos.setY(i, heightAt(wx, wz) - y + 0.12);
    }
    this.markerMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: MARKER_FRAG,
      uniforms: { uColor: { value: new THREE.Color(0xfff2d6) }, uAlpha: { value: 1 }, uTime: { value: 0 }, uActive: { value: 0 } },
    });
    this.marker = new THREE.Mesh(geo, this.markerMat);
    this.marker.position.y = 0.05;
    this.marker.renderOrder = 3;
    this.root.add(this.marker);
    this.update(0, 0);
  }

  /** A part was paid for: it settles in once the flying item lands (`delay` seconds). */
  addPart(index: number, delay: number): void {
    const p = this.parts[index];
    if (!p || p.built) return;
    p.built = true;
    p.delay = delay;
    p.t = 0;
  }

  /** Where part `index` sits in the world (its bounding-box centre), for the flying item to aim at. */
  partCenter(index: number, out: THREE.Vector3): THREE.Vector3 {
    const p = this.parts[index];
    if (!p) return this.root.getWorldPosition(out);
    (p.meshes[0] as THREE.Mesh).geometry.boundingBox!.getCenter(out);
    return this.root.localToWorld(out);
  }

  /** How far the first part (the deck) has settled in, 0..1: the site's contact shadow follows it (Painted+). */
  get groundShade(): number {
    const p = this.parts[0];
    return p && p.built && p.delay <= 0 ? p.t : 0;
  }

  get complete(): boolean {
    return this.parts.every((p) => p.built);
  }

  update(dt: number, time: number): void {
    let anyBuilt = false;
    for (const p of this.parts) {
      if (p.built) anyBuilt = true;
      if (p.built && p.delay > 0) p.delay -= dt;
      else if (p.built && p.t < 1) p.t = Math.min(1, p.t + dt / 0.55);
      const shown = p.built && p.delay <= 0;
      // Settle: drop in from a little above with a soft overshoot, never a pop.
      const k = p.t;
      const ease = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
      for (const mesh of p.meshes) {
        mesh.visible = shown;
        mesh.position.y = shown ? (1 - Math.min(1, ease)) * 0.9 : 0;
        mesh.scale.setScalar(shown ? 0.85 + 0.15 * Math.min(1, ease) : 1);
      }
      p.ghost.visible = !shown || p.t < 0.6;
    }
    for (const s of this.swingers) {
      // A slow, uneven sway, as if a breeze came and went.
      const t = time + s.phase;
      s.pivot.rotation.z = Math.sin(t * 1.3) * 0.07 + Math.sin(t * 0.47) * 0.04;
      s.pivot.rotation.x = Math.cos(t * 1.07) * 0.05;
    }
    const done = this.complete && this.parts.every((p) => p.t >= 1);
    this.scaffoldS = damp(this.scaffoldS, anyBuilt && !done ? 1 : 0, done ? 1.2 : 3, dt);
    this.scaffold.visible = this.scaffoldS > 0.01;
    this.scaffold.scale.set(1, this.scaffoldS, 1);
    this.markerAlpha = damp(this.markerAlpha, this.complete ? 0 : 1, 1.5, dt);
    this.marker.visible = this.markerAlpha > 0.01;
    const u = this.markerMat.uniforms;
    u.uAlpha.value = this.markerAlpha;
    u.uTime.value = time;
    u.uActive.value = damp(u.uActive.value as number, this.active ? 1 : 0, 6, dt);
    this.ghostMat.opacity = 0.22 * this.markerAlpha + 0.02;
  }

  dispose(): void {
    this.markerMat.dispose();
    this.marker.geometry.dispose();
    this.ghostMat.dispose();
    this.scaffold.geometry.dispose();
  }
}
