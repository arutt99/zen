// Building kits (plan 3.3, art decision point A5): a small library of procedural building parts
// (footings, decks, posts, beams, wall screens, roofs, lanterns, scaffolding) in two styles, and the
// shelter assembled from them one part per unit delivered. Each part settles into place; a ghost
// outline shows what is still missing; scaffolding stands around an unfinished building.
// Later buildings (gravel garden, hall, bell tower) are assembled from the same library.
import * as THREE from 'three';
import { damp } from '../core/util';
import type { BuildingDef, KitStyleId } from '../data/buildings';
import { inked, Mats } from './materials';
import { MB, type Col } from './mb';

/** One part's models: solid (painted) and an optional glowing piece (lantern paper). */
export interface PartGeo { solid: THREE.BufferGeometry; glow?: THREE.BufferGeometry }

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
  if (s === 'temple') {
    m.box(0.17, h, 0.17, P.wood, { p: [x, y0 + h / 2, z], wobble: 0.004 });
    m.box(0.22, 0.06, 0.22, P.woodDark, { p: [x, y0 + 0.03, z] });
  } else {
    m.cyl(0.085, 0.105, h, P.wood, { p: [x, y0 + h / 2, z], wobble: 0.01, r: [0.015, 0, -0.01] }, 8, 2);
    m.torus(0.1, 0.022, P.rope, { p: [x, y0 + h - 0.22, z], r: [Math.PI / 2, 0, 0] }, 5, 10);
    m.torus(0.1, 0.022, P.rope, { p: [x, y0 + h - 0.32, z], r: [Math.PI / 2, 0, 0] }, 5, 10);
  }
}

/** A horizontal beam between two points at height y. */
function beam(m: MB, s: KitStyleId, ax: number, az: number, bx: number, bz: number, y: number, thick = 1) {
  const P = PAL[s];
  const len = Math.hypot(bx - ax, bz - az);
  const ry = Math.atan2(bx - ax, bz - az);
  if (s === 'temple') m.box(0.13 * thick, 0.16 * thick, len, P.woodDark, { p: [(ax + bx) / 2, y, (az + bz) / 2], r: [0, ry, 0] });
  else m.cyl(0.07 * thick, 0.07 * thick, len, P.wood, { p: [(ax + bx) / 2, y, (az + bz) / 2], r: [Math.PI / 2, ry, 0], wobble: 0.006 }, 7);
}

/** Footings and a floor: stone blocks + planks (temple) or stones + logs (timber). */
function floor(m: MB, s: KitStyleId, w: number, d: number, y: number) {
  const P = PAL[s];
  for (const fx of [-1, 0, 1]) for (const fz of [-1, 1]) {
    if (s === 'temple') m.box(0.32, y, 0.32, P.stone, { p: [fx * (w / 2 - 0.2), y / 2, fz * (d / 2 - 0.2)], wobble: 0.02 });
    else m.ico(0.24, P.stone, { p: [fx * (w / 2 - 0.2), y * 0.45, fz * (d / 2 - 0.2)], s: [1.1, y * 3, 1], wobble: 0.03 }, 1);
  }
  if (s === 'temple') {
    m.box(w, 0.08, d, P.woodDark, { p: [0, y + 0.04, 0] });
    const n = 8;
    for (let i = 0; i < n; i++) m.box(w / n - 0.025, 0.06, d, P.plank, { p: [-w / 2 + (i + 0.5) * (w / n), y + 0.11, 0], wobble: 0.003 });
    // Two stone steps up to the front.
    m.box(1.0, 0.16, 0.36, P.stone, { p: [0, 0.08, d / 2 + 0.24], wobble: 0.012 });
    m.box(0.9, 0.16, 0.3, P.stone, { p: [0, 0.24, d / 2 + 0.06], wobble: 0.012 });
  } else {
    const n = 9;
    for (let i = 0; i < n; i++) m.cyl(0.13, 0.13, w + 0.1, P.plank, { p: [0, y + 0.06, -d / 2 + (i + 0.5) * (d / n)], r: [0, 0, Math.PI / 2], wobble: 0.01 }, 7);
    m.ico(0.2, P.stone, { p: [0.1, 0.1, d / 2 + 0.3], s: [1.6, 0.6, 1.1], wobble: 0.03 }, 1);
  }
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

/** A gabled roof over a w x d footprint: grey tiles in rows with a ridge (temple) or layered thatch (timber). */
function roof(m: MB, s: KitStyleId, w: number, d: number, eave: number, rise: number): void {
  const P = PAL[s];
  const half = d / 2 + 0.45;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  const ridge = eave + rise;
  for (const side of [-1, 1]) {
    const cz = side * half / 2, cy = eave + rise / 2;
    if (s === 'temple') {
      // A board under the tiles, then rows of rounded tiles running down the slope.
      m.box(w + 0.7, 0.06, slope, P.woodDark, { p: [0, cy - 0.06, cz], r: [side * ang, 0, 0] });
      const rows = 11;
      for (let i = 0; i < rows; i++) {
        const x = -(w + 0.6) / 2 + (i + 0.5) * ((w + 0.6) / rows);
        m.cyl(0.11, 0.11, slope, P.roof, { p: [x, cy + 0.04, cz], r: [Math.PI / 2 + side * ang, 0, 0], s: [1, 1, 0.55] }, 7);
      }
      // A gentle upturn at the eave: an end row of tiles.
      m.box(w + 0.8, 0.1, 0.18, P.roof, { p: [0, eave - 0.02, side * (half + 0.02)], r: [-side * 0.25, 0, 0] });
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
    for (const sx of [-1, 1]) m.box(0.2, 0.28, 0.3, P.roof, { p: [sx * (w / 2 + 0.42), ridge + 0.16, 0], r: [0, 0, sx * -0.3] });
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

type KitBuilder = Record<string, (s: KitStyleId) => PartGeo>;
const W = 2.8, D = 2.4, FLOOR = 0.42;
const PX = 1.2, PZ = 1.0;

const shelterKit: KitBuilder = {
  deck: (s) => { const m = new MB(); floor(m, s, W, D, FLOOR); return { solid: m.build() }; },
  post_back_left: (s) => {
    const m = new MB();
    post(m, s, -PX, -PZ, FLOOR + 0.14, 2.0);
    screen(m, s, -PX + 0.08, 0, -PZ, FLOOR + 0.14, 1.55);
    return { solid: m.build() };
  },
  post_back_right: (s) => {
    const m = new MB();
    post(m, s, PX, -PZ, FLOOR + 0.14, 2.0);
    screen(m, s, 0, PX - 0.08, -PZ, FLOOR + 0.14, 1.55);
    beam(m, s, -PX - 0.2, -PZ, PX + 0.2, -PZ, FLOOR + 2.12);
    return { solid: m.build() };
  },
  post_front_left: (s) => {
    const m = new MB();
    post(m, s, -PX, PZ, FLOOR + 0.14, 1.85);
    beam(m, s, -PX, -PZ - 0.15, -PX, PZ + 0.15, FLOOR + 1.95, 0.9);
    if (s === 'timber') m.cyl(0.04, 0.04, 1.3, PAL.timber.wood, { p: [-PX, FLOOR + 1.4, PZ - 0.45], r: [0.85, 0, 0] }, 5);
    return { solid: m.build() };
  },
  post_front_right: (s) => {
    const m = new MB();
    const g = new MB();
    post(m, s, PX, PZ, FLOOR + 0.14, 1.85);
    beam(m, s, PX, -PZ - 0.15, PX, PZ + 0.15, FLOOR + 1.95, 0.9);
    beam(m, s, -PX - 0.2, PZ, PX + 0.2, PZ, FLOOR + 1.98);
    if (s === 'temple') noren(m, 0, FLOOR + 1.9, PZ + 0.08, 1.3);
    else m.cyl(0.04, 0.04, 1.3, PAL.timber.wood, { p: [PX, FLOOR + 1.4, PZ - 0.45], r: [0.85, 0, 0] }, 5);
    return g.empty ? { solid: m.build() } : { solid: m.build(), glow: g.build() };
  },
  roof: (s) => {
    const m = new MB();
    const g = new MB();
    roof(m, s, W, D, FLOOR + 2.1, s === 'temple' ? 0.95 : 1.15);
    if (s === 'temple') lantern(m, g, PX + 0.3, FLOOR + 1.6, PZ + 0.35);
    return g.empty ? { solid: m.build() } : { solid: m.build(), glow: g.build() };
  },
};

const KITS: Record<string, KitBuilder> = { shelter_kit: shelterKit };

/** Every part id each kit can draw (the data test checks buildings only use these). */
export const KIT_PARTS: Record<string, string[]> = Object.fromEntries(Object.entries(KITS).map(([k, v]) => [k, Object.keys(v)]));

const geoCache = new Map<string, PartGeo>();
export function partGeo(kit: string, part: string, style: KitStyleId = 'temple'): PartGeo {
  const key = `${style}/${kit}/${part}`;
  let g = geoCache.get(key);
  if (!g) {
    g = KITS[kit]![part]!(style);
    g.solid.computeBoundingBox();
    geoCache.set(key, g);
  }
  return g;
}

/** Scaffolding: squared lumber with a ladder (temple) or poles lashed with rope (timber). */
function scaffoldGeo(s: KitStyleId): THREE.BufferGeometry {
  const m = new MB();
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
  return m.build();
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
  meshes: THREE.Mesh[];
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
  active = false;

  constructor(readonly def: BuildingDef, x: number, z: number, rot: number, heightAt: (x: number, z: number) => number, built: boolean[], readonly style: KitStyleId = 'temple') {
    const y = heightAt(x, z);
    this.root.position.set(x, y - 0.05, z);
    this.root.rotation.y = rot;
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.22, depthWrite: false });
    def.parts.forEach((p, i) => {
      const geo = partGeo(def.kit, p.id, style);
      const mesh = inked(new THREE.Mesh(geo.solid, Mats.std), 'building');
      mesh.castShadow = mesh.receiveShadow = true;
      const meshes: THREE.Mesh[] = [mesh];
      if (geo.glow) meshes.push(new THREE.Mesh(geo.glow, Mats.glow));
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
    p.meshes[0]!.geometry.boundingBox!.getCenter(out);
    return this.root.localToWorld(out);
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
