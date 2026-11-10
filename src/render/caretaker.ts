// Placeholder caretaker: a capsule body, head, hair bun, an arm with a tool, and a wicker basket on
// the back that visibly fills item by item (plan 7.2): one stick per wood, one pebble per stone.
// Built with Lanternfall's model builder (MB) and painted material. Phase 2 replaces the model (A4).
import * as THREE from 'three';
import { damp } from '../core/util';
import { SATCHEL_CAP } from '../data/gathering';
import type { WorkKind } from '../sim/loop';
import { inked, Mats } from './materials';
import { MB } from './mb';

/** Where the basket's opening is, in the caretaker's local space (before the size option). */
export const BASKET_TOP = new THREE.Vector3(0, 1.05, -0.36);

interface Slot { s: number; m: THREE.Matrix4 }

class BasketItems {
  readonly mesh: THREE.InstancedMesh;
  private slots: Slot[] = [];
  private tmp = new THREE.Matrix4();
  private scl = new THREE.Matrix4();

  constructor(geo: THREE.BufferGeometry, place: (i: number) => THREE.Matrix4) {
    this.mesh = inked(new THREE.InstancedMesh(geo, Mats.std, SATCHEL_CAP));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < SATCHEL_CAP; i++) this.slots.push({ s: 0, m: place(i) });
  }

  /** Eases each slot toward shown (the first `count`) or hidden, newest first. */
  update(dt: number, count: number): void {
    let n = 0;
    this.slots.forEach((sl, i) => {
      sl.s = damp(sl.s, i < count ? 1 : 0, i < count ? 14 : 10, dt);
      if (sl.s < 0.02) return;
      const k = Math.min(1.12, sl.s * (1 + 0.25 * (1 - sl.s) * 4)); // a small pop when an item lands
      this.tmp.copy(sl.m).multiply(this.scl.makeScale(k, k, k));
      this.mesh.setMatrixAt(n++, this.tmp);
    });
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class CaretakerView {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private arm = new THREE.Group();
  private axe: THREE.Mesh;
  private mallet: THREE.Mesh;
  private basket = new THREE.Group();
  private sticks: BasketItems;
  private stones: BasketItems;
  private bob = 0;
  private bump = 0;
  private toolShow = 0;
  private lastTool: 'chop' | 'chip' = 'chop';
  private swing = 0;
  private lean = 0;
  size = 1;

  constructor() {
    this.root.name = 'caretaker';
    const m = new MB();
    m.add(new THREE.CapsuleGeometry(0.3, 0.55, 6, 14), [0xe2d6bd, 0xf2e8d2], { p: [0, 0.6, 0] });
    m.sphere(0.3, 0xf1d3b5, { p: [0, 1.28, 0] }, 16, 12);
    m.sphere(0.32, 0x3a2e28, { p: [0, 1.36, -0.05], s: [1, 0.82, 1] }, 14, 10);
    m.sphere(0.14, 0x3a2e28, { p: [0, 1.62, -0.12] }, 10, 8);
    m.cyl(0.31, 0.31, 0.06, 0x846b50, { p: [0, 0.52, 0] }, 14);
    const mesh = inked(new THREE.Mesh(m.build(), Mats.std));
    mesh.castShadow = true;
    this.body.add(mesh);

    // The basket rides on the back and fills from the top.
    const b = new MB();
    b.cyl(0.25, 0.19, 0.44, [0x9a7a55, 0xd9c39d], { p: [0, 0, 0], wobble: 0.008 }, 12);
    b.torus(0.25, 0.025, 0x846b50, { p: [0, 0.22, 0], r: [Math.PI / 2, 0, 0] }, 5, 16);
    const basketMesh = inked(new THREE.Mesh(b.build(), Mats.std));
    basketMesh.castShadow = true;
    this.basket.position.set(0, 0.82, -0.36);
    this.basket.add(basketMesh);
    const stickGeo = new MB().cyl(0.025, 0.035, 0.55, [0x6e4c32, 0xa48a62], {}, 5).build();
    const stoneGeo = new MB().ico(0.065, [0x7d7b6e, 0xb0aa94], { s: [1.2, 0.8, 1], wobble: 0.01 }, 0).build();
    this.sticks = new BasketItems(stickGeo, (i) => {
      // Sticks stand in a loose sheaf toward the back, rising a little as the basket fills.
      const a = i * 2.39996;
      const r = 0.05 + ((i * 7) % 5) * 0.028;
      const lean = 0.18 + ((i * 3) % 4) * 0.05;
      const e = new THREE.Euler(Math.cos(a) * lean - 0.15, 0, Math.sin(a) * lean);
      return new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * r, 0.2 + i * 0.006, -0.03 + Math.cos(a) * r * 0.8), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1));
    });
    this.stones = new BasketItems(stoneGeo, (i) => {
      // Pebbles fill the front of the basket in a heap that grows upward.
      const layer = Math.floor(i / 6), k = i % 6;
      const a = k * 1.047 + layer * 0.5;
      const r = k === 0 ? 0.02 : 0.11;
      return new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, 0.12 + layer * 0.07, 0.06 + Math.sin(a) * r * 0.7), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 1.7, 0)), new THREE.Vector3(1, 1, 1));
    });
    this.basket.add(this.sticks.mesh, this.stones.mesh);
    this.body.add(this.basket);

    // The working arm pivots at the right shoulder; the tool hangs from the hand.
    this.arm.position.set(0.3, 0.98, 0.02);
    const armMesh = inked(new THREE.Mesh(new MB().cyl(0.07, 0.08, 0.5, [0xe2d6bd, 0xf2e8d2], { p: [0, -0.25, 0] }, 8).sphere(0.08, 0xf1d3b5, { p: [0, -0.52, 0] }, 8, 6).build(), Mats.std));
    armMesh.castShadow = true;
    this.arm.add(armMesh);
    const axe = new MB().cyl(0.03, 0.03, 0.62, 0x9a7a55, { p: [0, -0.52, 0.27], r: [Math.PI / 2, 0, 0] }, 6).box(0.04, 0.2, 0.15, [0x8a8a86, 0xc9c6ba], { p: [0, -0.46, 0.55] });
    this.axe = inked(new THREE.Mesh(axe.build(), Mats.std));
    const mallet = new MB().cyl(0.028, 0.028, 0.42, 0x9a7a55, { p: [0, -0.52, 0.18], r: [Math.PI / 2, 0, 0] }, 6).cyl(0.07, 0.07, 0.17, [0x846b50, 0xa48a62], { p: [0, -0.52, 0.42] }, 8);
    this.mallet = inked(new THREE.Mesh(mallet.build(), Mats.std));
    this.arm.add(this.axe, this.mallet);
    this.body.add(this.arm);
    this.root.add(this.body);
  }

  /** The basket bumps when something lands in it. */
  bumpBasket(): void {
    this.bump = 1;
  }

  /** World position of the basket's opening (for items flying out of it). */
  basketTop(out: THREE.Vector3): THREE.Vector3 {
    return this.basket.localToWorld(out.set(0, 0.25, 0));
  }

  update(
    dt: number, x: number, y: number, z: number, heading: number, speed: number,
    carry: { wood: number; stone: number }, work: { kind: WorkKind; phase: number } | null,
  ): void {
    this.root.position.set(x, y, z);
    this.root.scale.setScalar(this.size);
    // Turn smoothly toward the heading, taking the short way around.
    let d = heading - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 12);
    this.bob += dt * (4 + speed * 2.5);
    const amp = Math.min(1, speed / 3) * 0.05;
    this.body.position.y = Math.abs(Math.sin(this.bob)) * amp;
    this.body.rotation.z = Math.sin(this.bob) * amp * 0.6;

    // Tool swing timed to the beat: wind up slowly, strike quickly as the beat lands (phase → 1).
    const tool = work && work.kind !== 'deposit' ? work.kind : null;
    this.toolShow = damp(this.toolShow, tool ? 1 : 0, 10, dt);
    if (tool) this.lastTool = tool;
    this.axe.visible = this.lastTool === 'chop' && this.toolShow > 0.02;
    this.mallet.visible = this.lastTool === 'chip' && this.toolShow > 0.02;
    this.axe.scale.setScalar(Math.max(0.01, this.toolShow));
    this.mallet.scale.setScalar(Math.max(0.01, this.toolShow));
    let swing = 0, lean = 0;
    if (tool && work) {
      const p = work.phase;
      const up = p < 0.72 ? smooth(p / 0.72) : 1 - smooth((p - 0.72) / 0.28);
      swing = -0.4 - up * 2.1; // arm raised forward-up at the top of the wind-up
      lean = 0.16 * (1 - up);
    } else if (work?.kind === 'deposit') {
      // A small tossing motion in time with the beat, as each item flies to the site.
      const p = work.phase;
      swing = -1.2 - Math.sin(p * Math.PI) * 1.0;
      lean = 0.04;
    } else {
      swing = Math.sin(this.bob) * amp * 4; // a gentle arm swing while walking
    }
    this.swing = damp(this.swing, swing, tool ? 28 : 10, dt);
    this.lean = damp(this.lean, lean, 12, dt);
    this.arm.rotation.x = this.swing;
    this.body.rotation.x = this.lean;

    this.bump = Math.max(0, this.bump - dt * 5);
    this.basket.scale.set(1 + this.bump * 0.12, 1 - this.bump * 0.08, 1 + this.bump * 0.12);
    this.sticks.update(dt, carry.wood);
    this.stones.update(dt, carry.stone);
  }
}

function smooth(t: number) {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}
