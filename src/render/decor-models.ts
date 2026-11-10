// Adapted from Lanternfall (games/lanternfall/src/render/decor-models.ts @ b282628).
// Kept: oak, birch, bush, pine, willow, reedclump, rock (unchanged). Dropped: fantasy, desert,
// frost and volcano kinds and the story landmarks. Added for Moss & Bell: cherry, bench.
// Phase 2 adds the Zen kit (plan 10): maple, bamboo, mossy stone, stone lantern, wooden and rope
// fences, raked gravel, stepping stones and lotus. `ink` says which outline class a kind belongs to.
// Painted+ (2026-11-10, look detail 'fine'): rounded stones, crowns made of clustered leaf clumps,
// branches that reach into the crown, and a finer stone lantern. Models get baked occlusion from the
// ground and from each other (MB.build) when the look asks for it.
import * as THREE from 'three';
import type { OutlineClass } from '../data/looks';
import { fine, look } from './look';
import { MB, type Col, type PartOpts } from './mb';

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

/** A stone: faceted (Phase 2) or rounded with soft, smooth shading (Painted+). */
export function stone(m: MB, r: number, col: Col, o: PartOpts = {}): MB {
  if (!fine()) return m.ico(r, col, o, 1);
  return m.ico(r, col, { ...o, flat: false, smooth: true, wobble: (o.wobble ?? 0) * 0.8, wobbleFreq: o.wobbleFreq ?? 1.1 }, 3);
}

function mossyStone(m: MB, l: MB, x: number, z: number, r: number) {
  stone(m, r, GREY, { p: [x, r * 0.45, z], s: [1.1, 0.72, 1], wobble: r * 0.12 });
  if (fine()) {
    // A moss cushion that hugs the top, with a few soft tufts spilling down the sides.
    l.ico(r * 0.9, MOSS, { p: [x - r * 0.05, r * 0.74, z + r * 0.04], s: [1.05, 0.36, 0.98], wobble: r * 0.07, flat: false, smooth: true, puff: 0.35 }, 2);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + 0.4;
      l.ico(r * 0.28, MOSS, { p: [x + Math.cos(a) * r * 0.7, r * 0.55, z + Math.sin(a) * r * 0.62], s: [1.2, 0.5, 1], flat: false, smooth: true, puff: 0.4 }, 1);
    }
    return;
  }
  l.ico(r * 0.92, MOSS, { p: [x - r * 0.05, r * 0.72, z + r * 0.04], s: [1.05, 0.38, 0.98], wobble: r * 0.08, flat: false, puff: 0.5 }, 1);
}

const BARK: [number, number] = [0x3f2a1e, 0x6e4c32];
const BIRCH: [number, number] = [0xa59f92, 0xe9e4d8];

/**
 * A leaf mass for Painted+: one smooth, gently lumpy crown with a couple of softer clumps riding on its
 * upper side, so a tree reads as a few big masses of leaves catching the light, not a pile of bubbles.
 */
export function leafCluster(l: MB, x: number, y: number, z: number, r: number, col: [number, number], seed: number, flatten = 1): void {
  l.ico(r * 0.92, col, { p: [x, y, z], s: [1, flatten, 1], wobble: r * 0.15, wobbleFreq: 1.05, flat: false, smooth: true, puff: 0.55 }, 3);
  const n = 1 + Math.round(r);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + seed * 1.3;
    const up = 0.35 + 0.3 * (((i * 3 + seed) % 4) / 3);
    const ring = Math.sqrt(1 - up * up);
    const rr = r * (0.5 + 0.1 * (((i * 7 + seed * 3) % 5) / 4));
    const d = r * 0.55;
    l.ico(rr, col, {
      p: [x + Math.cos(a) * ring * d, y + up * d * flatten, z + Math.sin(a) * ring * d],
      s: [1, 0.85 * flatten + 0.15, 1], wobble: rr * 0.14, wobbleFreq: 1.2, flat: false, smooth: true, puff: 0.6,
    }, 2);
  }
}

function canopy(l: MB, blobs: [number, number, number, number][], col: [number, number]) {
  blobs.forEach(([x, y, z, r], i) => {
    if (fine()) leafCluster(l, x, y, z, r, col, i);
    else l.ico(r, col, { p: [x, y, z], wobble: r * 0.12, wobbleFreq: 1.6, flat: false, puff: 0.75 }, 2);
  });
}

/** Branches from the trunk top out into the crown (Painted+): the tree reads as grown, not stacked. */
function branches(m: MB, y: number, spread: number, col: [number, number], count = 3) {
  if (!fine()) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.5;
    const len = spread * (0.9 + (i % 2) * 0.25);
    const tilt = 0.75 + (i % 2) * 0.2;
    m.cyl(0.035, 0.08, len, col, {
      p: [Math.cos(a) * Math.sin(tilt) * len / 2, y + Math.cos(tilt) * len / 2, Math.sin(a) * Math.sin(tilt) * len / 2],
      r: [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt], wobble: 0.01,
    }, 6);
  }
}

/** Builds a model with baked occlusion: crowns shade the trunk under them; both sit on the ground. */
function finish(m: MB, l?: MB): { solid: THREE.BufferGeometry; leaf?: THREE.BufferGeometry } {
  if (!l) return { solid: m.build({ ground: true }) };
  const leaf = l.build({ ground: true });
  return { solid: m.build({ ground: true, occluders: [leaf] }), leaf };
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
    branches(m, 2.3, 1.5, BARK);
    canopy(l, [[0, 3.6, 0, 1.75], [1.15, 3.05, 0.35, 1.15], [-1.1, 3.1, -0.3, 1.2], [0.2, 2.95, -1.1, 1.05], [-0.3, 3.0, 1.1, 1.0], [0.3, 4.6, 0.1, 1]], [0x2f7a30, 0xa5d04f]);
    return finish(m, l);
  },
  birch() {
    const m = new MB(); const l = new MB();
    trunk(m, 4.2, 0.2, BIRCH, 0.03);
    for (let i = 0; i < 5; i++) m.box(0.17, 0.05, 0.42, 0x2f2a28, { p: [0, 0.8 + i * 0.68, 0.02], s: [1, 1, 1], r: [0, i * 1.7, 0] });
    canopy(l, [[0, 4.8, 0, 1.25], [0.6, 4.1, 0.2, 0.85], [-0.55, 4.25, -0.2, 0.85], [0, 5.7, 0, 0.75]], [0x8ca82a, 0xf2d84f]);
    return finish(m, l);
  },
  bush() {
    const l = new MB();
    canopy(l, [[0, 0.5, 0, 0.72], [0.55, 0.35, 0.1, 0.5], [-0.5, 0.38, -0.2, 0.52]], [0x2f6e2c, 0x8fc249]);
    const m = new MB();
    m.sphere(0.06, 0xff5e62, { p: [0.3, 0.92, 0.45] }, 5, 4);
    m.sphere(0.06, 0xff5e62, { p: [-0.25, 0.85, 0.5] }, 5, 4);
    return finish(m, l);
  },
  pine() {
    const m = new MB(); const l = new MB();
    trunk(m, 1.8, 0.33, BARK);
    pineTiers(l, 1.1, 4, 1.85, 2.05, [0x143f3a, 0x3f8a58]);
    return finish(m, l);
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
    return finish(m, l);
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
    return { solid: new MB().sphere(0.01, 0, {}, 3, 2).build(), leaf: l.build({ ground: true }) };
  },
  rock() {
    const m = new MB();
    stone(m, 1, [0x5b5962, 0xa5a098], { p: [0, 0.45, 0], s: [1.1, 0.74, 1], wobble: 0.14 });
    stone(m, 0.5, [0x5b5962, 0xa5a098], { p: [0.8, 0.22, 0.25], s: [1, 0.72, 1], wobble: 0.06 });
    if (fine()) stone(m, 0.22, [0x5b5962, 0xa5a098], { p: [-0.75, 0.08, 0.55], s: [1.2, 0.6, 1], wobble: 0.03 });
    return finish(m);
  },
  cherry() {
    const m = new MB(); const l = new MB();
    trunk(m, 2.2, 0.32, [0x3b2a24, 0x6b4a3a], 0.12);
    m.cyl(0.08, 0.16, 1.6, [0x3b2a24, 0x6b4a3a], { p: [0.55, 2.4, 0.1], r: [0, 0, -0.7] }, 6);
    m.cyl(0.07, 0.14, 1.4, [0x3b2a24, 0x6b4a3a], { p: [-0.5, 2.5, -0.15], r: [0.1, 0, 0.75] }, 6);
    branches(m, 2.1, 1.3, [0x3b2a24, 0x6b4a3a], 2);
    canopy(l, [[0, 3.3, 0, 1.45], [1.25, 3.0, 0.2, 1.05], [-1.15, 3.1, -0.25, 1.1], [0.15, 2.9, -1.0, 0.95], [-0.2, 3.0, 1.0, 0.9], [0.2, 4.1, 0.1, 0.85]], [0xd98aa0, 0xf6d2dc]);
    return finish(m, l);
  },
  bench() {
    const m = new MB();
    m.box(1.7, 0.12, 0.5, [0x9a7a55, 0xd9c39d], { p: [0, 0.46, 0], wobble: 0.01 });
    m.box(0.26, 0.42, 0.42, [0x7d7b6e, 0x9d9c8b], { p: [-0.62, 0.21, 0], wobble: 0.02 });
    m.box(0.26, 0.42, 0.42, [0x7d7b6e, 0x9d9c8b], { p: [0.62, 0.21, 0], wobble: 0.02 });
    return { ...finish(m), ink: 'building' };
  },
  maple() {
    // A Japanese maple: a low, spreading crown of soft red-orange layers on a twisting trunk.
    const m = new MB(); const l = new MB();
    trunk(m, 1.7, 0.24, [0x3b2a24, 0x6b4a3a], 0.16);
    m.cyl(0.06, 0.11, 1.4, [0x3b2a24, 0x6b4a3a], { p: [0.5, 1.9, 0.1], r: [0, 0, -0.85] }, 6);
    m.cyl(0.05, 0.1, 1.2, [0x3b2a24, 0x6b4a3a], { p: [-0.45, 2.0, -0.2], r: [0.2, 0, 0.8] }, 6);
    const tiers: [number, number, number, number][] = [[0, 2.4, 0, 1.2], [1.1, 2.15, 0.25, 0.85], [-1.0, 2.25, -0.25, 0.9], [0.2, 2.2, -0.95, 0.75], [-0.25, 2.3, 0.9, 0.75], [0.1, 3.0, 0.05, 0.75]];
    tiers.forEach(([x, y, z, r], i) => {
      if (fine()) leafCluster(l, x, y, z, r, [0xb4523c, 0xeaa064], i, 0.62);
      else l.ico(r, [0xb4523c, 0xeaa064], { p: [x, y, z], s: [1, 0.62, 1], wobble: r * 0.12, wobbleFreq: 1.8, flat: false, puff: 0.7 }, 2);
    });
    return finish(m, l);
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
    return finish(m, l);
  },
  mossy_stone() {
    const m = new MB(); const l = new MB();
    mossyStone(m, l, 0, 0, 0.75);
    mossyStone(m, l, 0.85, 0.3, 0.38);
    return finish(m, l);
  },
  stone_lantern() {
    if (fine()) return fineLantern();
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
    return { solid: m.build({ ground: true }), glow: g.build({ off: true }), ink: 'building' };
  },
  fence_wood() {
    // A low post-and-rail fence, 2 m along x.
    const m = new MB();
    for (const x of [-1, 0, 1]) m.box(0.12, 0.85, 0.12, CEDAR, { p: [x, 0.42, 0], wobble: 0.005 });
    for (const y of [0.35, 0.68]) m.box(2.1, 0.08, 0.07, CEDAR, { p: [0, y, 0.04], wobble: 0.004 });
    if (fine()) for (const x of [-1, 0, 1]) m.box(0.15, 0.04, 0.15, CEDAR[0], { p: [x, 0.86, 0] });
    return { ...finish(m), ink: 'building' };
  },
  fence_rope() {
    // Short stakes with a sagging rope, 2 m along x: a gentle "keep to the path" edge.
    const m = new MB();
    for (const x of [-1, 1]) m.cyl(0.05, 0.06, 0.6, CEDAR, { p: [x, 0.3, 0] }, 6);
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) / 8, x = -1 + t * 2, sag = 0.12 * Math.sin(t * Math.PI);
      m.cyl(0.018, 0.018, 0.27, 0xc8b07a, { p: [x, 0.52 - sag, 0], r: [0, 0, Math.PI / 2 + (t - 0.5) * 0.45] }, 4);
    }
    return { ...finish(m), ink: 'building' };
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
    if (fine()) m.cyl(0.42, 0.46, 0.1, [0x8e8c80, 0xb8b4a4], { p: [0, 0.05, 0], s: [1, 1, 0.72], wobble: 0.025, smooth: true }, 18, 2);
    else m.cyl(0.42, 0.46, 0.1, [0x8e8c80, 0xb8b4a4], { p: [0, 0.05, 0], s: [1, 1, 0.72], wobble: 0.02 }, 9);
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

/**
 * The Painted+ stone lantern: a stepped hexagonal base, a turned post, a platform, a firebox with
 * corner posts framing the glowing windows, a curved hexagonal cap with upturned corners, and a
 * jewel finial; moss settles on the cap and the base.
 */
function fineLantern(): DecorGeo {
  const m = new MB(); const g = new MB(); const l = new MB();
  const S = (o: PartOpts) => ({ wobble: 0.006, ...o });
  // Base: two stepped hexagonal slabs.
  m.cyl(0.46, 0.5, 0.12, GREY, S({ p: [0, 0.06, 0] }), 6);
  m.cyl(0.36, 0.42, 0.1, GREY, S({ p: [0, 0.17, 0] }), 6);
  // A turned post with a collar.
  m.lathe([[0.001, 0], [0.17, 0], [0.15, 0.06], [0.13, 0.3], [0.135, 0.5], [0.16, 0.56], [0.001, 0.56]], GREY, { p: [0, 0.22, 0] }, 14);
  // The platform the firebox stands on, with a lip.
  m.cyl(0.3, 0.22, 0.1, GREY, S({ p: [0, 0.83, 0] }), 6);
  m.cyl(0.36, 0.34, 0.05, GREY, S({ p: [0, 0.9, 0] }), 6);
  // Firebox: six corner posts, a lintel ring; the glow sits inside.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    m.box(0.07, 0.34, 0.07, GREY, { p: [Math.cos(a) * 0.24, 1.1, Math.sin(a) * 0.24], r: [0, -a, 0] });
  }
  m.cyl(0.29, 0.29, 0.05, GREY, S({ p: [0, 1.29, 0] }), 6);
  g.cyl(0.2, 0.2, 0.3, [0xf0a050, 0xffd090], { p: [0, 1.1, 0], gain: 1.6 }, 6);
  // The cap: a wide, gently curved hexagonal roof with upturned corners.
  m.lathe([[0.001, -0.02], [0.5, -0.03], [0.62, -0.04], [0.6, 0.0], [0.5, 0.08], [0.3, 0.2], [0.12, 0.3], [0.001, 0.32]], [0x6f6e64, 0x9a988a], { p: [0, 1.34, 0], r: [0, Math.PI / 6, 0] }, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.cone(0.05, 0.14, 0x8a887c, { p: [Math.cos(a) * 0.6, 1.37, Math.sin(a) * 0.6], r: [Math.sin(a) * -0.6, 0, Math.cos(a) * 0.6] }, 5);
  }
  // The finial: a lotus collar and a jewel.
  m.cyl(0.08, 0.1, 0.06, GREY, { p: [0, 1.69, 0] }, 10);
  m.lathe([[0.001, 0], [0.07, 0.02], [0.1, 0.08], [0.08, 0.15], [0.03, 0.2], [0.001, 0.22]], GREY, { p: [0, 1.72, 0] }, 12);
  // Moss on the cap and at the foot.
  l.ico(0.26, MOSS, { p: [0.14, 1.52, 0.06], s: [1.6, 0.26, 1.3], flat: false, smooth: true, puff: 0.4 }, 2);
  l.ico(0.2, MOSS, { p: [-0.32, 0.13, 0.22], s: [1.5, 0.35, 1.1], flat: false, smooth: true, puff: 0.4 }, 2);
  const leaf = l.build({ ground: true });
  return { solid: m.build({ ground: true, occluders: [leaf] }), leaf, glow: g.build({ off: true }), ink: 'building' };
}

const cache = new Map<string, DecorGeo>();
export function decorGeo(kind: string): DecorGeo {
  // Keyed by look: Painted+ builds other models and bakes occlusion into them.
  const key = `${look().id}/${kind}`;
  let g = cache.get(key);
  if (!g) {
    g = builders[kind]();
    cache.set(key, g);
  }
  return g;
}
