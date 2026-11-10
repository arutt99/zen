// Building kits: one simple procedural model per part (plan 3.3). A building grows one part per unit
// delivered; each part settles into place, and a ghost outline shows what is still missing. While
// it is incomplete, scaffolding stands around it. The kit style is art decision point A5 (Phase 2):
// these are deliberately plain placeholders.
import * as THREE from 'three';
import { damp } from '../core/util';
import type { BuildingDef } from '../data/buildings';
import { inked, Mats } from './materials';
import { MB } from './mb';

const CEDAR: [number, number] = [0x6e5640, 0x9a7a58];
const LIGHT: [number, number] = [0xb89a6e, 0xd9c39d];
const ROOF: [number, number] = [0x6f5a44, 0xa88a62];

type KitBuilder = Record<string, () => THREE.BufferGeometry>;

/** Shelter: 2.8 x 2.4 m deck, four posts, a gabled roof. Faces +z. */
const shelterKit: KitBuilder = {
  deck: () => {
    const m = new MB();
    m.box(2.8, 0.16, 2.4, LIGHT, { p: [0, 0.3, 0], wobble: 0.01 });
    for (const [x, z] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]] as const) m.box(0.3, 0.3, 0.3, [0x7d7b6e, 0x9d9c8b], { p: [x, 0.12, z], wobble: 0.03 });
    for (let i = 0; i < 6; i++) m.box(0.02, 0.01, 2.36, CEDAR[0], { p: [-1.15 + i * 0.46, 0.385, 0] });
    return m.build();
  },
  post_back_left: () => new MB().box(0.18, 2.0, 0.18, CEDAR, { p: [-1.2, 1.38, -1.0], wobble: 0.01 }).build(),
  post_back_right: () => new MB().box(0.18, 2.0, 0.18, CEDAR, { p: [1.2, 1.38, -1.0], wobble: 0.01 }).build(),
  post_front_left: () => new MB().box(0.18, 1.85, 0.18, CEDAR, { p: [-1.2, 1.31, 1.0], wobble: 0.01 }).build(),
  post_front_right: () => new MB().box(0.18, 1.85, 0.18, CEDAR, { p: [1.2, 1.31, 1.0], wobble: 0.01 }).build(),
  roof: () => {
    const m = new MB();
    m.box(3.1, 0.14, 0.16, CEDAR, { p: [0, 2.3, 1.0] });
    m.box(3.1, 0.14, 0.16, CEDAR, { p: [0, 2.42, -1.0] });
    m.box(3.5, 0.1, 1.75, ROOF, { p: [0, 2.72, 0.72], r: [0.42, 0, 0], wobble: 0.015 });
    m.box(3.5, 0.1, 1.75, ROOF, { p: [0, 2.72, -0.72], r: [-0.42, 0, 0], wobble: 0.015 });
    m.cyl(0.08, 0.08, 3.6, CEDAR, { p: [0, 3.06, 0], r: [0, 0, Math.PI / 2] }, 7);
    return m.build();
  },
};

const KITS: Record<string, KitBuilder> = { shelter_kit: shelterKit };

/** Every part id each kit can draw (the data test checks buildings only use these). */
export const KIT_PARTS: Record<string, string[]> = Object.fromEntries(Object.entries(KITS).map(([k, v]) => [k, Object.keys(v)]));

const geoCache = new Map<string, THREE.BufferGeometry>();
export function partGeo(kit: string, part: string): THREE.BufferGeometry {
  const key = `${kit}/${part}`;
  let g = geoCache.get(key);
  if (!g) {
    g = KITS[kit]![part]!();
    g.computeBoundingBox();
    geoCache.set(key, g);
  }
  return g;
}

function scaffoldGeo(): THREE.BufferGeometry {
  const m = new MB();
  const pole = (x: number, z: number, h: number) => m.cyl(0.045, 0.055, h, LIGHT, { p: [x, h / 2, z], r: [0.03, 0, -0.02] }, 5);
  pole(-1.65, 1.35, 3.0); pole(1.65, 1.35, 3.0); pole(-1.65, -1.35, 3.2); pole(1.65, -1.35, 3.2);
  m.cyl(0.035, 0.035, 3.4, LIGHT, { p: [0, 1.6, 1.35], r: [0, 0, Math.PI / 2] }, 5);
  m.cyl(0.035, 0.035, 3.4, LIGHT, { p: [0, 1.7, -1.35], r: [0, 0, Math.PI / 2] }, 5);
  m.cyl(0.035, 0.035, 2.8, LIGHT, { p: [-1.65, 2.2, 0], r: [Math.PI / 2, 0, 0] }, 5);
  m.cyl(0.035, 0.035, 2.8, LIGHT, { p: [1.65, 2.2, 0], r: [Math.PI / 2, 0, 0] }, 5);
  for (const [x, z] of [[-1.65, 1.35], [1.65, 1.35], [-1.65, -1.35], [1.65, -1.35]] as const) m.torus(0.07, 0.025, 0xa48a62, { p: [x, 1.6, z], r: [Math.PI / 2, 0, 0] }, 5, 10);
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
  mesh: THREE.Mesh;
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

  constructor(readonly def: BuildingDef, x: number, z: number, rot: number, heightAt: (x: number, z: number) => number, built: boolean[]) {
    const y = heightAt(x, z);
    this.root.position.set(x, y - 0.05, z);
    this.root.rotation.y = rot;
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.22, depthWrite: false });
    def.parts.forEach((p, i) => {
      const geo = partGeo(def.kit, p.id);
      const mesh = inked(new THREE.Mesh(geo, Mats.std));
      mesh.castShadow = mesh.receiveShadow = true;
      const ghost = new THREE.Mesh(geo, this.ghostMat);
      ghost.renderOrder = 4;
      this.root.add(mesh, ghost);
      this.parts.push({ mesh, ghost, built: !!built[i], delay: 0, t: built[i] ? 1 : 0 });
    });
    this.scaffold = inked(new THREE.Mesh(scaffoldGeo(), Mats.std));
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
    p.mesh.geometry.boundingBox!.getCenter(out);
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
      p.mesh.visible = shown;
      p.mesh.position.y = shown ? (1 - Math.min(1, ease)) * 0.9 : 0;
      p.mesh.scale.setScalar(shown ? 0.85 + 0.15 * Math.min(1, ease) : 1);
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
