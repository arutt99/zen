// Lanternfall+ "rich" detail (owner request 2026-11-10, PC first): ground dressing, life and lantern light.
// - Ground dressing (`dressingPlan` + `dressingGeos`): edging stones along the path, pebbles, moss patches
//   at the feet of rocks and trees, fallen petals under the cherries, clover and flower clumps in the
//   meadow, and twigs under the trees. Placed once from the island, drawn instanced.
// - Life (`Life`): butterflies by day, leaves and petals drifting down from the crowns, koi under the
//   pond's surface. Animated every frame on the CPU (a few dozen objects; cheap on a PC).
// - Lantern light: `staticLamps` lists the stone lanterns; the shaders light the ground and things near
//   them at dusk and night (materials.ts LAMP_GLSL).
// Only built when the look's detail is 'rich'. Placement is pure and testable (no WebGL needed).
import * as THREE from 'three';
import type { OutlineClass } from '../data/looks';
import { clamp, makeRng } from '../core/util';
import type { IslandWorld } from '../sim/island';
import { BUILDINGS } from '../data/buildings';
import { decorGeo, stone } from './decor-models';
import { MB } from './mb';
import { Mats, paint } from './materials';

export type DressKind = 'edge' | 'pebble' | 'moss' | 'petal' | 'clover' | 'twig';
export const DRESS_KINDS: readonly DressKind[] = ['edge', 'pebble', 'moss', 'petal', 'clover', 'twig'];

/** One kind of dressing: where each piece goes and a brightness tint per piece. */
export interface DressList { mats: THREE.Matrix4[]; tints: number[] }

const LEAFY = new Set(['oak', 'birch', 'cherry', 'maple', 'willow']);

/** Where every piece of dressing goes on this island. Deterministic for a given place. */
export function dressingPlan(world: IslandWorld): Record<DressKind, DressList> {
  const out = Object.fromEntries(DRESS_KINDS.map((k) => [k, { mats: [], tints: [] }])) as unknown as Record<DressKind, DressList>;
  const rng = makeRng(world.seed * 31 + 7);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const place = world.place;
  const sites = place.sites.map((s) => ({ x: s.x, z: s.z, r: (BUILDINGS[s.building]?.siteRadius ?? 3) + 0.4 }));
  const nodes = place.nodes.map((n) => ({ x: n.x, z: n.z }));
  const pond = place.pond;
  const dry = (x: number, z: number, margin = 0.25) => !world.hasWater || world.height(x, z) > world.waterLevel + margin;
  const clearOfSites = (x: number, z: number) => sites.every((s) => Math.hypot(s.x - x, s.z - z) > s.r);
  const onIsland = (x: number, z: number) => world.islandMask(x, z) > 0.15;
  const add = (k: DressKind, x: number, y: number, z: number, yaw: number, s: [number, number, number], tilt = 0, tint = 1) => {
    E.set(tilt * (rng() - 0.5), yaw, tilt * (rng() - 0.5));
    Q.setFromEuler(E);
    M.compose(P.set(x, y, z), Q, S.set(...s));
    out[k].mats.push(M.clone());
    out[k].tints.push(tint);
  };

  // Edging stones along both sides of the path, long side along it, with the odd gap.
  const tmp = { x: 0, z: 0, dx: 0, dz: 0 };
  for (const road of world.roads) {
    for (let d = 0.3; d < road.length; d += 0.46) {
      road.sample(d, tmp);
      for (const side of [-1, 1]) {
        if (rng() < 0.12) continue;
        const off = world.pathWidth * 0.5 + 0.06 + rng() * 0.06;
        const x = tmp.x - tmp.dz * off * side, z = tmp.z + tmp.dx * off * side;
        if (!onIsland(x, z) || !dry(x, z) || !clearOfSites(x, z)) continue;
        const sc = 0.75 + rng() * 0.5;
        add('edge', x, world.height(x, z) - 0.02, z, Math.atan2(-tmp.dz, tmp.dx) + (rng() - 0.5) * 0.4, [sc, sc * (0.8 + rng() * 0.4), sc], 0.15, 0.85 + rng() * 0.25);
      }
    }
  }

  // Pebbles: scattered along the path's margins and around rocks.
  for (let t = 0; t < 4000 && out.pebble.mats.length < 420; t++) {
    let x: number, z: number;
    if (rng() < 0.65) {
      const road = world.roads[0]!;
      road.sample(rng() * road.length, tmp);
      const off = world.pathWidth * 0.5 + 0.2 + rng() * 1.6;
      const side = rng() < 0.5 ? -1 : 1;
      x = tmp.x - tmp.dz * off * side; z = tmp.z + tmp.dx * off * side;
    } else {
      const b = world.blockers[Math.floor(rng() * world.blockers.length)];
      if (!b || !/rock|stone/.test(b.kind)) continue;
      const a = rng() * Math.PI * 2, r = b.scale * (0.9 + rng() * 0.9);
      x = b.x + Math.cos(a) * r; z = b.z + Math.sin(a) * r;
    }
    if (!onIsland(x, z) || !dry(x, z) || !clearOfSites(x, z)) continue;
    const sc = 0.5 + rng() * 0.8;
    add('pebble', x, world.height(x, z) - 0.01, z, rng() * 6.28, [sc, sc * (0.6 + rng() * 0.5), sc], 0.4, 0.8 + rng() * 0.35);
  }

  // Moss at the feet of rocks, mossy stones and trees, on the shady side more often.
  const mossy = [...world.blockers.filter((b) => /rock|stone|oak|maple|cherry|birch|willow/.test(b.kind) && b.kind !== 'stepping_stone'), ...nodes.map((n) => ({ x: n.x, z: n.z, scale: 1, kind: 'node' }))];
  for (const b of mossy) {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = (rng() < 0.6 ? Math.PI * 0.5 : 0) + rng() * Math.PI * 1.2;
      const r = (b.kind === 'node' ? 0.8 : b.scale * (/rock|stone/.test(b.kind) ? 0.95 : 0.6)) + rng() * 0.5;
      const x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r;
      if (!onIsland(x, z) || !dry(x, z) || !clearOfSites(x, z) || world.roadDistance(x, z) < world.pathWidth * 0.5 + 0.2) continue;
      const sc = 0.5 + rng() * 0.8;
      add('moss', x, world.height(x, z) - 0.015, z, rng() * 6.28, [sc * (1 + rng() * 0.6), 1, sc], 0.1, 0.85 + rng() * 0.3);
    }
  }

  // Petals under the cherries (props and decor alike), thickest near the trunk.
  for (const b of world.blockers.filter((q) => q.kind === 'cherry')) {
    for (let i = 0; i < 90; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 2.9 * b.scale;
      const x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r;
      if (!onIsland(x, z) || !clearOfSites(x, z)) continue;
      // Petals float on the pond too.
      const y = world.hasWater && world.height(x, z) < world.waterLevel ? world.waterLevel + 0.025 : world.height(x, z) + 0.01;
      add('petal', x, y, z, rng() * 6.28, [1, 1, 1], 0.5, 0.9 + rng() * 0.2);
    }
  }

  // Clover and flower clumps in the open meadow.
  for (let t = 0; t < 5000 && out.clover.mats.length < 170; t++) {
    const x = (rng() * 2 - 1) * (world.halfW + 3), z = (rng() * 2 - 1) * (world.halfH + 3);
    if (!onIsland(x, z) || !dry(x, z, 0.35) || !clearOfSites(x, z)) continue;
    if (world.roadDistance(x, z) < world.pathWidth * 0.5 + 0.35) continue;
    if (nodes.some((n) => Math.hypot(n.x - x, n.z - z) < 1.6)) continue;
    if (world.solids.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.3)) continue;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r * 0.8) continue;
    const sc = 0.7 + rng() * 0.6;
    add('clover', x, world.height(x, z) - 0.02, z, rng() * 6.28, [sc, sc, sc], 0.1, 0.85 + rng() * 0.3);
  }

  // Twigs under the leafy trees.
  for (const b of world.blockers.filter((q) => LEAFY.has(q.kind))) {
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2, r = (0.7 + rng() * 1.6) * b.scale;
      const x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r;
      if (!onIsland(x, z) || !dry(x, z) || !clearOfSites(x, z) || world.roadDistance(x, z) < world.pathWidth * 0.5) continue;
      const sc = 0.7 + rng() * 0.6;
      add('twig', x, world.height(x, z) + 0.02, z, rng() * 6.28, [sc, sc, sc], 0.1, 0.85 + rng() * 0.3);
    }
  }
  return out;
}

/** The models for each kind of dressing, with how they draw: shadow-casting, outline class. */
export function dressingGeos(rock: [number, number]): Record<DressKind, { geo: THREE.BufferGeometry; shadow: boolean; ink: OutlineClass | null }> {
  const edge = stone(new MB(), 0.17, rock, { s: [1.45, 0.62, 1.0], wobble: 0.02, p: [0, 0.04, 0] }).build({ ground: true, groundY: -0.04 });
  const pebble = stone(new MB(), 0.075, rock, { s: [1.2, 0.6, 1], wobble: 0.01, p: [0, 0.02, 0] }).build();
  const moss = new MB().ico(0.32, [0x4f7a34, 0x86ad55], { s: [1, 0.16, 0.85], wobble: 0.05, flat: false, smooth: true, puff: 0.3 }, 2)
    .ico(0.18, [0x4f7a34, 0x86ad55], { p: [0.22, 0.01, 0.1], s: [1, 0.2, 1], flat: false, smooth: true, puff: 0.3 }, 1).build();
  const petal = new MB().box(0.075, 0.006, 0.05, [0xe9a9b8, 0xf6d2dc], {}).build({ off: true });
  const clover = new MB();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    clover.ico(0.075, [0x3f7a2f, 0x7fb04c], { p: [Math.cos(a) * 0.09, 0.05 + (i % 2) * 0.02, Math.sin(a) * 0.09], s: [1.2, 0.45, 1.2], flat: false, puff: 0.5 }, 1);
  }
  clover.ico(0.08, [0x3f7a2f, 0x7fb04c], { p: [0, 0.08, 0], s: [1.2, 0.5, 1.2], flat: false, puff: 0.5 }, 1);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4;
    clover.cyl(0.006, 0.008, 0.16, 0x4f7a32, { p: [Math.cos(a) * 0.06, 0.1, Math.sin(a) * 0.06] }, 4);
    clover.sphere(0.03, i === 1 ? 0xf2d26a : 0xfaf6ea, { p: [Math.cos(a) * 0.06, 0.19, Math.sin(a) * 0.06], s: [1, 0.7, 1] }, 6, 4);
  }
  const twig = new MB().setMark('bark')
    .cyl(0.012, 0.02, 0.6, [0x4a3426, 0x6e5440], { p: [0, 0.015, 0], r: [0, 0, Math.PI / 2] }, 5)
    .cyl(0.008, 0.012, 0.22, [0x4a3426, 0x6e5440], { p: [0.12, 0.015, 0.06], r: [0, -0.7, Math.PI / 2] }, 4).build();
  return {
    edge: { geo: edge, shadow: true, ink: 'nature' },
    pebble: { geo: pebble, shadow: false, ink: null },
    moss: { geo: moss, shadow: false, ink: null },
    petal: { geo: petal, shadow: false, ink: null },
    clover: { geo: clover.build({ ground: true }), shadow: false, ink: 'nature' },
    twig: { geo: twig, shadow: false, ink: null },
  };
}

/** Stone lanterns on the island (x, y of the firebox, z), for the lantern-light shader. */
export function staticLamps(world: IslandWorld): THREE.Vector4[] {
  return world.blockers.filter((b) => b.kind === 'stone_lantern')
    .map((b) => new THREE.Vector4(b.x, world.height(b.x, b.z) + 1.1 * b.scale, b.z, 1));
}

// ---------------------------------------------------------------------------------------------
// Life: butterflies, drifting leaves and koi.

interface Butterfly { obj: THREE.Group; wingL: THREE.Object3D; wingR: THREE.Object3D; cx: number; cz: number; r: number; w: number; phase: number; flap: number; lift: number }
interface Leaf { x: number; y: number; z: number; vy: number; spin: number; phase: number; src: number; ground: number }
interface Koi { obj: THREE.Group; tail: THREE.Object3D; phase: number; speed: number; r: number }

const LEAF_COLORS: Record<string, number> = { oak: 0x7aab45, birch: 0xd8c84f, cherry: 0xf0b2c0, maple: 0xe0884c, willow: 0x93a54f, node: 0x8bbd55 };

export class Life {
  readonly group = new THREE.Group();
  private butterflies: Butterfly[] = [];
  private leaves: Leaf[] = [];
  private leafMesh: THREE.InstancedMesh;
  private sources: { x: number; y: number; z: number; r: number; ground: number }[] = [];
  private koi: Koi[] = [];
  private koiMat: THREE.Material;
  private last = 0;
  private M = new THREE.Matrix4();
  private Q = new THREE.Quaternion();
  private E = new THREE.Euler();
  private V = new THREE.Vector3();
  private S = new THREE.Vector3(1, 1, 1);

  constructor(private world: IslandWorld) {
    const rng = makeRng(world.seed * 53 + 11);
    // Butterflies: a body and two wings that flap, each circling its own patch of meadow.
    const colors = [0xfaf3e4, 0xf3d36a, 0xa8c8ec, 0xf0a060, 0xfaf3e4, 0xe8b8d8];
    const body = new MB().cyl(0.012, 0.016, 0.12, 0x3a2e28, { r: [Math.PI / 2, 0, 0] }, 5).build({ off: true });
    // One wing per side (mirroring a mesh would turn its faces inside out).
    const wing = (c: number, sx: number) => new MB()
      .box(0.11, 0.004, 0.08, [c, c], { p: [0.06 * sx, 0, -0.012], r: [0, 0.25 * sx, 0] })
      .box(0.08, 0.004, 0.06, [c, c], { p: [0.05 * sx, 0, 0.045], r: [0, -0.3 * sx, 0] })
      .build({ off: true });
    const wingGeos = colors.map((c) => [wing(c, 1), wing(c, -1)] as const);
    for (let i = 0; i < 16; i++) {
      let cx = 0, cz = 0;
      for (let t = 0; t < 40; t++) {
        cx = (rng() * 2 - 1) * world.halfW * 0.9; cz = (rng() * 2 - 1) * world.halfH * 0.9;
        if (world.walkable(cx, cz)) break;
      }
      const obj = new THREE.Group();
      obj.add(new THREE.Mesh(body, Mats.std));
      const [gl, gr] = wingGeos[i % wingGeos.length]!;
      const wingL = new THREE.Mesh(gl, Mats.std);
      const wingR = new THREE.Mesh(gr, Mats.std);
      obj.add(wingL, wingR);
      this.group.add(obj);
      this.butterflies.push({ obj, wingL, wingR, cx, cz, r: 1.2 + rng() * 2.2, w: 0.25 + rng() * 0.25, phase: rng() * 100, flap: 14 + rng() * 6, lift: 0.6 + rng() * 0.7 });
    }

    // Leaves and petals drift down from the crowns and settle, then start again from the top.
    for (const b of world.blockers) {
      if (!LEAFY.has(b.kind)) continue;
      const leaf = decorGeo(b.kind).leaf;
      if (!leaf) continue;
      leaf.computeBoundingBox();
      const bb = leaf.boundingBox!;
      this.sources.push({ x: b.x, y: world.height(b.x, b.z) + (bb.min.y + (bb.max.y - bb.min.y) * 0.4) * b.scale, z: b.z, r: (bb.max.x - bb.min.x) * 0.38 * b.scale, ground: world.height(b.x, b.z) });
    }
    const leafGeo = new MB().box(0.09, 0.006, 0.055, [0xffffff, 0xffffff], {}).build({ off: true });
    const n = Math.min(90, this.sources.length * 6);
    this.leafMesh = new THREE.InstancedMesh(leafGeo, Mats.std, Math.max(1, n));
    this.leafMesh.count = n;
    this.leafMesh.frustumCulled = false;
    const kinds = world.blockers.filter((b) => LEAFY.has(b.kind) && decorGeo(b.kind).leaf).map((b) => b.kind);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const src = i % this.sources.length;
      const l: Leaf = { x: 0, y: 0, z: 0, vy: 0, spin: 0, phase: rng() * 100, src, ground: 0 };
      this.respawn(l, rng, true);
      this.leaves.push(l);
      this.leafMesh.setColorAt(i, col.set(LEAF_COLORS[kinds[src] ?? 'node'] ?? 0x8bbd55));
    }
    if (n > 0) this.group.add(this.leafMesh);
    this.rng = rng;

    // Koi: a few fish gliding just under the pond's surface, drawn after the water so they show through.
    this.koiMat = paint(new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }), { brush: 0.3 });
    if (world.hasWater) {
      const patterns: [number, number][] = [[0xf06a2a, 0xfaf2e6], [0xfaf2e6, 0xe85a20], [0xf0b040, 0xfaf2e6]];
      patterns.forEach(([a, b], i) => {
        const bodyM = new MB()
          .sphere(0.12, a, { s: [0.75, 0.5, 2.0], p: [0, 0, 0.04] }, 10, 8)
          .sphere(0.07, b, { s: [0.9, 0.6, 1.4], p: [0.02, 0.035, 0.12] }, 8, 6)
          .sphere(0.06, b, { s: [0.9, 0.6, 1.2], p: [-0.02, 0.03, -0.1] }, 8, 6)
          .cone(0.05, 0.1, a, { p: [0.09, -0.01, 0.06], r: [0, 0, -1.4], s: [1, 1, 0.3] }, 5)
          .cone(0.05, 0.1, a, { p: [-0.09, -0.01, 0.06], r: [0, 0, 1.4], s: [1, 1, 0.3] }, 5);
        const tailM = new MB().cone(0.09, 0.16, a, { p: [0, 0, -0.08], r: [-Math.PI / 2, 0, 0], s: [1, 0.25, 1] }, 6);
        const obj = new THREE.Group();
        const bm = new THREE.Mesh(bodyM.build({ off: true }), this.koiMat);
        const tail = new THREE.Group();
        tail.position.z = -0.2;
        tail.add(new THREE.Mesh(tailM.build({ off: true }), this.koiMat));
        bm.renderOrder = tail.children[0]!.renderOrder = 5;
        obj.add(bm, tail);
        this.group.add(obj);
        this.koi.push({ obj, tail, phase: i * 2.1, speed: 0.16 + i * 0.03, r: world.place.pond.r * (0.35 + i * 0.12) });
      });
    }
  }
  private rng: () => number;

  private respawn(l: Leaf, rng: () => number, anywhere = false) {
    const s = this.sources[l.src]!;
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * s.r;
    l.x = s.x + Math.cos(a) * r; l.z = s.z + Math.sin(a) * r;
    l.ground = this.world.height(l.x, l.z) + 0.01;
    if (this.world.hasWater && l.ground < this.world.waterLevel) l.ground = this.world.waterLevel + 0.02;
    l.y = anywhere ? l.ground + rng() * (s.y - l.ground) : s.y;
    l.vy = 0.28 + rng() * 0.2;
    l.spin = (rng() - 0.5) * 3;
  }

  /** Animate; `day` 0..1 (butterflies only by day). */
  update(time: number, day: number): void {
    const dt = clamp(time - this.last, 0, 0.1);
    this.last = time;
    const w = this.world;
    for (const b of this.butterflies) {
      const t = time * b.w + b.phase;
      const x = b.cx + Math.cos(t) * b.r + Math.sin(t * 2.3) * 0.5;
      const z = b.cz + Math.sin(t) * b.r * 0.8 + Math.cos(t * 1.7) * 0.5;
      const dx = -Math.sin(t) * b.r + Math.cos(t * 2.3) * 1.15, dz = Math.cos(t) * b.r * 0.8 - Math.sin(t * 1.7) * 0.85;
      b.obj.position.set(x, w.height(x, z) + b.lift + Math.sin(time * 1.9 + b.phase) * 0.18, z);
      b.obj.rotation.y = Math.atan2(dx, dz);
      const flap = Math.sin(time * b.flap + b.phase) * 0.9;
      b.wingL.rotation.z = flap;
      b.wingR.rotation.z = -flap;
      b.obj.visible = day > 0.15;
      b.obj.scale.setScalar(clamp((day - 0.15) * 3));
    }
    for (let i = 0; i < this.leaves.length; i++) {
      const l = this.leaves[i]!;
      if (l.y > l.ground) {
        l.y -= l.vy * dt;
        l.x += Math.sin(time * 1.3 + l.phase) * 0.25 * dt;
        l.z += Math.cos(time * 1.1 + l.phase) * 0.2 * dt;
        if (l.y <= l.ground) l.y = l.ground;
      } else if (this.rng() < dt * 0.12) this.respawn(l, this.rng);
      const falling = l.y > l.ground + 0.02;
      this.E.set(falling ? Math.sin(time * 2.2 + l.phase) * 0.8 : 0, l.phase + (falling ? time * l.spin : 0), falling ? Math.cos(time * 1.7 + l.phase) * 0.6 : 0);
      this.Q.setFromEuler(this.E);
      this.leafMesh.setMatrixAt(i, this.M.compose(this.V.set(l.x, l.y, l.z), this.Q, this.S));
    }
    this.leafMesh.instanceMatrix.needsUpdate = true;
    if (this.koi.length) {
      const p = w.place.pond;
      for (const k of this.koi) {
        const t = time * k.speed + k.phase;
        const r = k.r * (1 + 0.15 * Math.sin(t * 1.7));
        const x = p.x + Math.cos(t) * r, z = p.z + Math.sin(t) * r * 0.8;
        k.obj.position.set(x, w.waterLevel - 0.05, z);
        k.obj.rotation.y = Math.atan2(-Math.sin(t) * r, Math.cos(t) * r * 0.8);
        k.tail.rotation.y = Math.sin(time * 5 + k.phase) * 0.45;
      }
    }
  }

  dispose(): void {
    this.leafMesh.dispose();
    this.koiMat.dispose();
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
}
