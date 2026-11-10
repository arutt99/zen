// Adapted from Lanternfall (games/lanternfall/src/render/decor-models.ts @ b282628).
// Kept: oak, birch, bush, pine, willow, reedclump, rock (unchanged). Dropped: fantasy, desert,
// frost and volcano kinds and the story landmarks. Added for Moss & Bell: cherry, bench.
// Phase 2 adds the Zen kit (plan 10): maple, bamboo, mossy stone, stone lantern, wooden and rope
// fences, raked gravel, stepping stones and lotus. `ink` says which outline class a kind belongs to.
import * as THREE from 'three';
import type { OutlineClass } from '../data/looks';
import { MB } from './mb';

export interface DecorGeo {
  /** Static or wind-free parts. */
  solid: THREE.BufferGeometry;
  /** Wind-swayed foliage. */
  leaf?: THREE.BufferGeometry;
  glow?: THREE.BufferGeometry;
  /** Outline class for the look (default: nature). Built things are 'building'. */
  ink?: OutlineClass;
  /** Sits on the water surface instead of the ground (lotus). */
  floats?: boolean;
  /** Casts no shadow and gets no outline (flat ground pieces). */
  flat?: boolean;
}

const MOSS: [number, number] = [0x5f7f3f, 0x9bb866];
const GREY: [number, number] = [0x86857a, 0xb4b1a2];
const CEDAR: [number, number] = [0x6e5640, 0x9a7a58];

function mossyStone(m: MB, l: MB, x: number, z: number, r: number) {
  m.ico(r, GREY, { p: [x, r * 0.45, z], s: [1.1, 0.72, 1], wobble: r * 0.12 }, 1);
  l.ico(r * 0.92, MOSS, { p: [x - r * 0.05, r * 0.72, z + r * 0.04], s: [1.05, 0.38, 0.98], wobble: r * 0.08, flat: false, puff: 0.5 }, 1);
}

const BARK: [number, number] = [0x3f2a1e, 0x6e4c32];
const BIRCH: [number, number] = [0xa59f92, 0xe9e4d8];

function canopy(l: MB, blobs: [number, number, number, number][], col: [number, number]) {
  for (const [x, y, z, r] of blobs) {
    l.ico(r, col, { p: [x, y, z], wobble: r * 0.12, wobbleFreq: 1.6, flat: false, puff: 0.75 }, 2);
  }
}

function trunk(m: MB, h: number, r: number, col: [number, number], lean = 0.05) {
  m.cyl(r * 0.6, r, h, col, { p: [0, h / 2, 0], r: [lean, 0, lean * 0.6], wobble: r * 0.12 }, 8, 3);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.7;
    m.cone(r * 0.55, r * 1.2, col[0], { p: [Math.cos(a) * r * 0.82, r * 0.4, Math.sin(a) * r * 0.82], r: [Math.sin(a) * 0.65, 0, -Math.cos(a) * 0.65] }, 5);
  }
}

function pineTiers(l: MB, y0: number, tiers: number, r: number, h: number, col: [number, number], snow = false) {
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const rr = r * (1 - t * 0.68);
    const hh = h * (1 - t * 0.2);
    l.cone(rr, hh, col, { p: [0, y0 + t * tiers * h * 0.56 + hh / 2, 0], r: [0, i, 0], wobble: rr * 0.05 }, 9, 2);
    if (snow) {
      l.cone(rr * 0.74, hh * 0.56, [0xdfeafa, 0xffffff], { p: [0, y0 + t * tiers * h * 0.56 + hh * 0.74, 0], r: [0, i, 0], wobble: rr * 0.05 }, 9);
    }
  }
}

const builders: Record<string, () => DecorGeo> = {
  oak() {
    const m = new MB(); const l = new MB();
    trunk(m, 2.6, 0.4, BARK);
    canopy(l, [[0, 3.6, 0, 1.75], [1.15, 3.05, 0.35, 1.15], [-1.1, 3.1, -0.3, 1.2], [0.2, 2.95, -1.1, 1.05], [-0.3, 3.0, 1.1, 1.0], [0.3, 4.6, 0.1, 1]], [0x2f7a30, 0xa5d04f]);
    return { solid: m.build(), leaf: l.build() };
  },
  birch() {
    const m = new MB(); const l = new MB();
    trunk(m, 4.2, 0.2, BIRCH, 0.03);
    for (let i = 0; i < 5; i++) m.box(0.17, 0.05, 0.42, 0x2f2a28, { p: [0, 0.8 + i * 0.68, 0.02], s: [1, 1, 1], r: [0, i * 1.7, 0] });
    canopy(l, [[0, 4.8, 0, 1.25], [0.6, 4.1, 0.2, 0.85], [-0.55, 4.25, -0.2, 0.85], [0, 5.7, 0, 0.75]], [0x8ca82a, 0xf2d84f]);
    return { solid: m.build(), leaf: l.build() };
  },
  bush() {
    const l = new MB();
    canopy(l, [[0, 0.5, 0, 0.72], [0.55, 0.35, 0.1, 0.5], [-0.5, 0.38, -0.2, 0.52]], [0x2f6e2c, 0x8fc249]);
    const m = new MB();
    m.sphere(0.06, 0xff5e62, { p: [0.3, 0.92, 0.45] }, 5, 4);
    m.sphere(0.06, 0xff5e62, { p: [-0.25, 0.85, 0.5] }, 5, 4);
    return { solid: m.build(), leaf: l.build() };
  },
  pine() {
    const m = new MB(); const l = new MB();
    trunk(m, 1.8, 0.33, BARK);
    pineTiers(l, 1.1, 4, 1.85, 2.05, [0x143f3a, 0x3f8a58]);
    return { solid: m.build(), leaf: l.build() };
  },
  willow() {
    const m = new MB(); const l = new MB();
    trunk(m, 3.2, 0.5, [0x2d2820, 0x5d5238], 0.12);
    canopy(l, [[0.25, 4, 0, 1.85], [1.3, 3.6, 0.2, 1.2], [-0.85, 3.65, -0.2, 1.25]], [0x45602f, 0x9caa52]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 1.2 + (i % 3) * 0.32;
      const h = 2.4 + (i % 4) * 0.35;
      l.cyl(0.11, 0.025, h, [0x7f9347, 0x57703a], { p: [0.2 + Math.cos(a) * r, 3.6 - h / 2, Math.sin(a) * r], r: [0, 0, 0] }, 4);
    }
    return { solid: m.build(), leaf: l.build() };
  },
  reedclump() {
    const l = new MB();
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const r = ((i * 13) % 7) * 0.09;
      const h = 1.1 + ((i * 5) % 7) * 0.2;
      l.cone(0.05, h, [0x4f6a30, 0xb3b35c], { p: [Math.cos(a) * r, h / 2, Math.sin(a) * r], r: [Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1] }, 4);
      if (i % 3 === 0) l.cyl(0.05, 0.05, 0.3, 0x5d3b1f, { p: [Math.cos(a) * r, h + 0.04, Math.sin(a) * r] }, 5);
    }
    return { solid: new MB().sphere(0.01, 0, {}, 3, 2).build(), leaf: l.build() };
  },
  rock() {
    const m = new MB();
    m.ico(1, [0x5b5962, 0xa5a098], { p: [0, 0.45, 0], s: [1.1, 0.74, 1], wobble: 0.14 }, 1);
    m.ico(0.5, [0x5b5962, 0xa5a098], { p: [0.8, 0.22, 0.25], s: [1, 0.72, 1], wobble: 0.06 }, 1);
    return { solid: m.build() };
  },
  cherry() {
    const m = new MB(); const l = new MB();
    trunk(m, 2.2, 0.32, [0x3b2a24, 0x6b4a3a], 0.12);
    m.cyl(0.08, 0.16, 1.6, [0x3b2a24, 0x6b4a3a], { p: [0.55, 2.4, 0.1], r: [0, 0, -0.7] }, 6);
    m.cyl(0.07, 0.14, 1.4, [0x3b2a24, 0x6b4a3a], { p: [-0.5, 2.5, -0.15], r: [0.1, 0, 0.75] }, 6);
    canopy(l, [[0, 3.3, 0, 1.45], [1.25, 3.0, 0.2, 1.05], [-1.15, 3.1, -0.25, 1.1], [0.15, 2.9, -1.0, 0.95], [-0.2, 3.0, 1.0, 0.9], [0.2, 4.1, 0.1, 0.85]], [0xd98aa0, 0xf6d2dc]);
    return { solid: m.build(), leaf: l.build() };
  },
  bench() {
    const m = new MB();
    m.box(1.7, 0.12, 0.5, [0x9a7a55, 0xd9c39d], { p: [0, 0.46, 0], wobble: 0.01 });
    m.box(0.26, 0.42, 0.42, [0x7d7b6e, 0x9d9c8b], { p: [-0.62, 0.21, 0], wobble: 0.02 });
    m.box(0.26, 0.42, 0.42, [0x7d7b6e, 0x9d9c8b], { p: [0.62, 0.21, 0], wobble: 0.02 });
    return { solid: m.build(), ink: 'building' };
  },
  maple() {
    // A Japanese maple: a low, spreading crown of soft red-orange layers on a twisting trunk.
    const m = new MB(); const l = new MB();
    trunk(m, 1.7, 0.24, [0x3b2a24, 0x6b4a3a], 0.16);
    m.cyl(0.06, 0.11, 1.4, [0x3b2a24, 0x6b4a3a], { p: [0.5, 1.9, 0.1], r: [0, 0, -0.85] }, 6);
    m.cyl(0.05, 0.1, 1.2, [0x3b2a24, 0x6b4a3a], { p: [-0.45, 2.0, -0.2], r: [0.2, 0, 0.8] }, 6);
    const tiers: [number, number, number, number][] = [[0, 2.4, 0, 1.2], [1.1, 2.15, 0.25, 0.85], [-1.0, 2.25, -0.25, 0.9], [0.2, 2.2, -0.95, 0.75], [-0.25, 2.3, 0.9, 0.75], [0.1, 3.0, 0.05, 0.75]];
    for (const [x, y, z, r] of tiers) l.ico(r, [0xb4523c, 0xeaa064], { p: [x, y, z], s: [1, 0.62, 1], wobble: r * 0.12, wobbleFreq: 1.8, flat: false, puff: 0.7 }, 2);
    return { solid: m.build(), leaf: l.build() };
  },
  bamboo() {
    // A clump of culms with nodes, and leaf tufts that sway.
    const m = new MB(); const l = new MB();
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 0.15 + (i % 3) * 0.17;
      const h = 4.2 + ((i * 5) % 4) * 0.55;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const lean: [number, number, number] = [0, 0, 0];
      m.cyl(0.05, 0.06, h, [0x6f8a4a, 0xa8b870], { p: [x, h / 2, z], r: lean }, 7);
      for (let k = 1; k < 7; k++) m.cyl(0.066, 0.066, 0.04, 0x5f7a3a, { p: [x, k * h / 7, z] }, 7);
      for (let k = 0; k < 3; k++) {
        const ty = h * (0.62 + k * 0.14);
        l.ico(0.42 - k * 0.06, [0x6c8f40, 0xb8cf78], { p: [x + Math.cos(a + k) * 0.35, ty, z + Math.sin(a + k) * 0.35], s: [1.5, 0.45, 0.9], r: [0, a + k, 0], wobble: 0.05, flat: false, puff: 0.6 }, 1);
      }
    }
    return { solid: m.build(), leaf: l.build() };
  },
  mossy_stone() {
    const m = new MB(); const l = new MB();
    mossyStone(m, l, 0, 0, 0.75);
    mossyStone(m, l, 0.85, 0.3, 0.38);
    return { solid: m.build(), leaf: l.build() };
  },
  stone_lantern() {
    // A tōrō-style garden lantern: base, post, firebox with glowing windows, a wide cap and finial.
    const m = new MB(); const g = new MB();
    m.cyl(0.42, 0.48, 0.18, GREY, { p: [0, 0.09, 0], wobble: 0.015 }, 6);
    m.cyl(0.14, 0.17, 0.62, GREY, { p: [0, 0.49, 0], wobble: 0.01 }, 8);
    m.cyl(0.36, 0.3, 0.12, GREY, { p: [0, 0.86, 0] }, 6);
    m.box(0.46, 0.38, 0.46, GREY, { p: [0, 1.11, 0], wobble: 0.01 });
    m.cone(0.62, 0.36, [0x6f6e64, 0x9a988a], { p: [0, 1.48, 0], r: [0, Math.PI / 6, 0] }, 6);
    m.sphere(0.1, GREY, { p: [0, 1.72, 0] }, 8, 6);
    m.ico(0.28, MOSS, { p: [0.12, 1.42, 0.05], s: [1.6, 0.3, 1.4], flat: false, puff: 0.5 }, 1);
    for (const r of [0, Math.PI / 2]) g.box(0.2, 0.2, 0.48, [0xf0a050, 0xffd090], { p: [0, 1.12, 0], r: [0, r, 0], gain: 1.6 });
    return { solid: m.build(), glow: g.build(), ink: 'building' };
  },
  fence_wood() {
    // A low post-and-rail fence, 2 m along x.
    const m = new MB();
    for (const x of [-1, 0, 1]) m.box(0.12, 0.85, 0.12, CEDAR, { p: [x, 0.42, 0], wobble: 0.005 });
    for (const y of [0.35, 0.68]) m.box(2.1, 0.08, 0.07, CEDAR, { p: [0, y, 0.04], wobble: 0.004 });
    return { solid: m.build(), ink: 'building' };
  },
  fence_rope() {
    // Short stakes with a sagging rope, 2 m along x: a gentle "keep to the path" edge.
    const m = new MB();
    for (const x of [-1, 1]) m.cyl(0.05, 0.06, 0.6, CEDAR, { p: [x, 0.3, 0] }, 6);
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) / 8, x = -1 + t * 2, sag = 0.12 * Math.sin(t * Math.PI);
      m.cyl(0.018, 0.018, 0.27, 0xc8b07a, { p: [x, 0.52 - sag, 0], r: [0, 0, Math.PI / 2 + (t - 0.5) * 0.45] }, 4);
    }
    return { solid: m.build(), ink: 'building' };
  },
  raked_gravel() {
    // A circle of pale gravel raked in rings around a mossy stone (r ≈ 2.4 m).
    const m = new MB(); const l = new MB();
    m.cyl(2.4, 2.45, 0.06, [0xc9c3b2, 0xe2dccb], { p: [0, 0.03, 0] }, 40);
    for (let i = 0; i < 6; i++) m.torus(0.75 + i * 0.28, 0.035, [0xa9a392, 0xbcb6a6], { p: [0, 0.065, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.5] }, 4, 48);
    mossyStone(m, l, 0, 0, 0.5);
    return { solid: m.build(), leaf: l.build(), flat: true };
  },
  stepping_stone() {
    const m = new MB();
    m.cyl(0.42, 0.46, 0.1, [0x8e8c80, 0xb8b4a4], { p: [0, 0.05, 0], s: [1, 1, 0.72], wobble: 0.02 }, 9);
    return { solid: m.build(), flat: true };
  },
  lotus() {
    // Two pads and a pink lotus flower on the water surface.
    const m = new MB();
    m.cyl(0.5, 0.5, 0.03, [0x4a7a40, 0x7aa860], { p: [0, 0.01, 0] }, 12);
    m.cyl(0.32, 0.32, 0.03, [0x4a7a40, 0x7aa860], { p: [0.75, 0.01, 0.35] }, 10);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.sphere(0.13, [0xf0a8b8, 0xfbe4ea], { p: [Math.cos(a) * 0.1, 0.14, Math.sin(a) * 0.1], s: [0.55, 1.2, 0.3], r: [Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5] }, 6, 5);
    }
    m.sphere(0.07, 0xf2d070, { p: [0, 0.16, 0] }, 6, 5);
    return { solid: m.build(), floats: true };
  },
};

const cache = new Map<string, DecorGeo>();
export function decorGeo(kind: string): DecorGeo {
  let g = cache.get(kind);
  if (!g) {
    g = builders[kind]();
    cache.set(kind, g);
  }
  return g;
}
