// The caretaker (plan 7.1, 7.2): a small figure in a cream top and brown hakama-style trousers, dark
// hair in a bun, a dot-and-line face, sandals, and a woven wicker basket on the back that visibly fills
// item by item (one stick per wood, one pebble per stone). Built in code with MB; two proportion styles
// (src/data/characters.ts, art decision point A4). Legs and arms swing while walking; the right arm
// swings the axe or mallet on the beat.
import * as THREE from 'three';
import { damp } from '../core/util';
import { CARETAKER, type CaretakerProportions, type CharacterStyleId } from '../data/characters';
import { SATCHEL_CAP } from '../data/gathering';
import type { WorkKind } from '../sim/loop';
import { inked, Mats } from './materials';
import { MB } from './mb';
import { contactBlob } from './contact';

const SKIN = 0xf3d6bc;
const CREAM: [number, number] = [0xe6dcc6, 0xf6eedc];
const HAKAMA: [number, number] = [0x4e3a2a, 0x6e5440];
const OBI = 0x5a4430;
const HAIR: [number, number] = [0x2a201c, 0x3e302a];
const SANDAL = 0x5a4632;
const WICKER_A = 0xa07a4c;
const WICKER_B = 0xc89e68;
const WICKER_RIB = 0x7a5a38;
const FACE = 0x2a201c;
const BLUSH = 0xf0a8a0;

interface Slot { s: number; m: THREE.Matrix4 }

class BasketItems {
  readonly mesh: THREE.InstancedMesh;
  private slots: Slot[] = [];
  private tmp = new THREE.Matrix4();
  private scl = new THREE.Matrix4();

  constructor(geo: THREE.BufferGeometry, place: (i: number) => THREE.Matrix4) {
    this.mesh = inked(new THREE.InstancedMesh(geo, Mats.std, SATCHEL_CAP), 'figure');
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

function figureMesh(geo: THREE.BufferGeometry, outline = true): THREE.Mesh {
  const m = outline ? inked(new THREE.Mesh(geo, Mats.std), 'figure') : new THREE.Mesh(geo, Mats.std);
  m.castShadow = true;
  return m;
}

/** A woven basket: alternating bands, dark ribs, a rim and two shoulder straps. Opening at y = h/2. */
function basketGeo(r: number, h: number): THREE.BufferGeometry {
  const b = new MB();
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = -h / 2 + (i / bands) * h;
    const rr0 = r * (0.78 + 0.22 * (i / bands));
    const rr1 = r * (0.78 + 0.22 * ((i + 1) / bands));
    b.cyl(rr1, rr0, h / bands, i % 2 ? WICKER_A : WICKER_B, { p: [0, y0 + h / bands / 2, 0], wobble: 0.004 }, 14);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.box(0.018, h * 0.98, 0.012, WICKER_RIB, { p: [Math.sin(a) * r * 0.9, 0, Math.cos(a) * r * 0.9], r: [-0.06 * Math.cos(a), a, 0.06 * Math.sin(a)] });
  }
  b.torus(r * 1.0, 0.028, WICKER_RIB, { p: [0, h / 2, 0], r: [Math.PI / 2, 0, 0] }, 6, 18);
  b.cyl(r * 0.8, r * 0.8, 0.02, WICKER_RIB, { p: [0, -h / 2, 0] }, 14);
  return b.build();
}

export class CaretakerView {
  readonly root = new THREE.Group();
  readonly style: CharacterStyleId;
  private p: CaretakerProportions;
  private body = new THREE.Group();
  private head = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private arm = new THREE.Group();
  private axe: THREE.Mesh;
  private mallet: THREE.Mesh;
  private basket = new THREE.Group();
  private basketTopY: number;
  private sticks: BasketItems;
  private stones: BasketItems;
  private bob = 0;
  private bump = 0;
  private toolShow = 0;
  private lastTool: 'chop' | 'chip' = 'chop';
  private swing = 0;
  private lean = 0;
  private stride = 0;
  size = 1;

  constructor(style: CharacterStyleId = 'chibi') {
    this.style = style;
    const p = this.p = CARETAKER[style];
    this.root.name = 'caretaker';

    // --- legs: wide hakama legs pivoting at the hip, sandals at the hem.
    for (const [g, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      g.position.set(side * p.waist * 0.45, p.hip, 0);
      const m = new MB();
      m.cyl(p.waist * 0.5, p.hem, p.hip - 0.06, HAKAMA, { p: [0, -(p.hip - 0.06) / 2, 0], wobble: 0.004 }, 10);
      m.box(p.hem * 1.1, 0.05, p.hem * 2.3, SANDAL, { p: [0, -p.hip + 0.025, p.hem * 0.35] });
      m.sphere(p.hem * 0.55, SKIN, { p: [0, -p.hip + 0.07, p.hem * 0.75], s: [1, 0.55, 1.2] }, 8, 6);
      g.add(figureMesh(m.build()));
      this.body.add(g);
    }

    // --- torso: a soft cream top over the hakama's waistband, a belt, a crossed collar.
    const t = new MB();
    const tH = p.shoulder - p.hip;
    t.lathe([[0.001, 0], [p.waist * 1.15, 0], [p.waist * 1.1, tH * 0.35], [p.chest, tH * 0.82], [p.chest * 0.82, tH * 0.97], [p.chest * 0.35, tH + 0.02], [0.001, tH + 0.03]], CREAM, { p: [0, p.hip - 0.04, 0] }, 16);
    t.cyl(p.waist * 1.2, p.waist * 1.32, Math.min(0.26, tH * 0.32), HAKAMA, { p: [0, p.hip + 0.02, 0] }, 16); // hakama top
    t.cyl(p.waist * 1.17, p.waist * 1.17, 0.06, OBI, { p: [0, p.hip + 0.13, 0] }, 16);
    const cz = p.chest * 0.86;
    // A crossed collar: two thin lines meeting in a V below the neck.
    t.box(0.022, tH * 0.42, 0.015, 0xb8a684, { p: [-p.chest * 0.13, p.shoulder - tH * 0.22, cz + 0.01], r: [0.2, 0, -0.42] });
    t.box(0.022, tH * 0.42, 0.015, 0xb8a684, { p: [p.chest * 0.13, p.shoulder - tH * 0.22, cz + 0.01], r: [0.2, 0, 0.42] });
    // Basket straps over the shoulders.
    for (const side of [-1, 1]) t.box(0.035, tH * 0.55, 0.02, 0x9a7a55, { p: [side * p.chest * 0.58, p.shoulder - tH * 0.26, p.chest * 0.8], r: [0.18, 0, 0] });
    this.body.add(figureMesh(t.build()));

    // --- head: skin, hair cap with bangs and side locks, the bun; a dot-and-line face (no outline).
    this.head.position.set(0, p.shoulder + p.head * 0.95, 0);
    const h = p.head;
    const hm = new MB();
    hm.sphere(h, SKIN, { s: [1, 1.03, 1] }, 18, 14);
    hm.sphere(h * 1.07, HAIR, { p: [0, h * 0.1, -h * 0.13], s: [1, 0.98, 0.98] }, 18, 14);
    hm.sphere(h * 0.78, HAIR, { p: [0, h * 0.5, h * 0.3], s: [1.15, 0.5, 0.75] }, 14, 10); // bangs
    for (const side of [-1, 1]) hm.cyl(h * 0.2, h * 0.14, h * 0.85, HAIR, { p: [side * h * 0.86, -h * 0.18, h * 0.12], r: [0, 0, side * 0.08] }, 8);
    hm.sphere(p.bun, HAIR, { p: [0, h * 1.0 + p.bun * 0.45, -h * 0.25] }, 12, 10);
    hm.torus(p.bun * 0.75, p.bun * 0.16, 0x8a6a48, { p: [0, h * 0.98 + p.bun * 0.1, -h * 0.22], r: [Math.PI / 2 + 0.3, 0, 0] }, 5, 12);
    this.head.add(figureMesh(hm.build()));
    const face = new MB();
    const onFace = (x: number, y: number) => Math.sqrt(Math.max(0, h * h * 1.0 - x * x - y * y)) + 0.006;
    for (const side of [-1, 1]) {
      const ex = side * h * p.eyeGap, ey = -h * 0.06;
      face.sphere(h * p.eye, FACE, { p: [ex, ey, onFace(ex, ey)], s: [0.8, 1.15, 0.45] }, 8, 6);
      const bx = side * h * (p.eyeGap + 0.16), by = -h * 0.32;
      face.sphere(h * 0.12, BLUSH, { p: [bx, by, onFace(bx, by) - 0.004], s: [1.3, 0.6, 0.3] }, 8, 6);
    }
    face.box(h * 0.16, h * 0.035, 0.01, FACE, { p: [0, -h * 0.36, onFace(0, -h * 0.36)] });
    this.head.add(figureMesh(face.build(), false));
    this.body.add(this.head);

    // --- the basket rides on the back and fills from the top.
    const br = 0.24 * p.basket, bh = 0.44 * p.basket;
    const basketMesh = figureMesh(basketGeo(br, bh));
    this.basket.position.set(0, (p.hip + p.shoulder) / 2 + 0.06, -(p.chest + br * 0.85));
    this.basket.rotation.x = -0.12;
    this.basketTopY = bh / 2;
    this.basket.add(basketMesh);
    const stickGeo = new MB().cyl(0.025, 0.035, 0.55, [0x6e4c32, 0xa48a62], {}, 5).build();
    const stoneGeo = new MB().ico(0.065, [0x7d7b6e, 0xb0aa94], { s: [1.2, 0.8, 1], wobble: 0.01 }, 0).build();
    const s = p.basket;
    this.sticks = new BasketItems(stickGeo, (i) => {
      // Sticks stand in a loose sheaf toward the back, rising a little as the basket fills.
      const a = i * 2.39996;
      const r = (0.04 + ((i * 7) % 5) * 0.025) * s;
      const lean = 0.18 + ((i * 3) % 4) * 0.05;
      const e = new THREE.Euler(Math.cos(a) * lean - 0.15, 0, Math.sin(a) * lean);
      return new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * r, bh * 0.45 + i * 0.006, -0.03 + Math.cos(a) * r * 0.8), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1));
    });
    this.stones = new BasketItems(stoneGeo, (i) => {
      // Pebbles fill the front of the basket in a heap that grows upward.
      const layer = Math.floor(i / 6), k = i % 6;
      const a = k * 1.047 + layer * 0.5;
      const r = (k === 0 ? 0.02 : 0.1) * s;
      return new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, bh * 0.28 + layer * 0.07, 0.05 + Math.sin(a) * r * 0.7), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 1.7, 0)), new THREE.Vector3(1, 1, 1));
    });
    this.basket.add(this.sticks.mesh, this.stones.mesh);
    this.body.add(this.basket);

    // --- arms: wide sleeves; the right one works, the left swings while walking.
    const armGeo = (() => {
      const m = new MB();
      m.cyl(0.075, 0.11, p.arm * 0.78, CREAM, { p: [0, -p.arm * 0.39, 0] }, 9);
      m.sphere(0.06, SKIN, { p: [0, -p.arm * 0.88, 0] }, 8, 6);
      return m.build();
    })();
    this.armL.position.set(-p.chest * 1.02, p.shoulder - 0.07, 0);
    this.armL.rotation.z = -0.12;
    this.armL.add(figureMesh(armGeo));
    this.body.add(this.armL);
    this.arm.position.set(p.chest * 1.02, p.shoulder - 0.07, 0.02);
    this.arm.add(figureMesh(armGeo));
    const hy = -p.arm * 0.88;
    const axe = new MB().cyl(0.03, 0.03, 0.62, 0x9a7a55, { p: [0, hy, 0.27], r: [Math.PI / 2, 0, 0] }, 6).box(0.04, 0.2, 0.15, [0x8a8a86, 0xc9c6ba], { p: [0, hy + 0.06, 0.55] });
    this.axe = figureMesh(axe.build());
    const mallet = new MB().cyl(0.028, 0.028, 0.42, 0x9a7a55, { p: [0, hy, 0.18], r: [Math.PI / 2, 0, 0] }, 6).cyl(0.07, 0.07, 0.17, [0x846b50, 0xa48a62], { p: [0, hy, 0.42] }, 8);
    this.mallet = figureMesh(mallet.build());
    this.arm.add(this.axe, this.mallet);
    this.body.add(this.arm);
    this.root.add(this.body);
    const blob = contactBlob(0.72);
    if (blob) this.root.add(blob);
  }

  /** The basket bumps when something lands in it. */
  bumpBasket(): void {
    this.bump = 1;
  }

  /** World position of the basket's opening (for items flying out of it). */
  basketTop(out: THREE.Vector3): THREE.Vector3 {
    return this.basket.localToWorld(out.set(0, this.basketTopY, 0));
  }

  /** World position of the chest, which the canopy fade keeps in view. */
  chest(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, this.p.shoulder, 0).applyMatrix4(this.root.matrixWorld);
  }

  update(
    dt: number, x: number, y: number, z: number, heading: number, speed: number,
    carry: { wood: number; stone: number }, work: { kind: WorkKind; phase: number } | null, sitting = false,
  ): void {
    this.root.position.set(x, y, z);
    this.root.scale.setScalar(this.size);
    // Turn smoothly toward the heading, taking the short way around.
    let d = heading - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 12);
    this.bob += dt * (4 + speed * 2.2);
    const walk = Math.min(1, speed / 3);
    this.stride = damp(this.stride, walk, 8, dt);
    const amp = walk * 0.04;
    this.body.position.y = Math.abs(Math.sin(this.bob)) * amp;
    this.body.rotation.z = Math.sin(this.bob) * amp * 0.5;
    const legSwing = Math.sin(this.bob) * 0.55 * this.stride;
    this.legL.rotation.x = sitting ? -1.3 : legSwing;
    this.legR.rotation.x = sitting ? -1.3 : -legSwing;
    this.armL.rotation.x = -legSwing * 0.8;
    // A small idle breath and head tilt so the figure never looks frozen.
    this.head.rotation.z = Math.sin(this.bob * 0.35) * 0.03 * (1 - this.stride);
    this.head.position.y = this.p.shoulder + this.p.head * 0.95 + Math.sin(this.bob * 0.5) * 0.006;

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
      const ph = work.phase;
      const up = ph < 0.72 ? smooth(ph / 0.72) : 1 - smooth((ph - 0.72) / 0.28);
      swing = -0.4 - up * 2.1; // arm raised forward-up at the top of the wind-up
      lean = 0.16 * (1 - up);
    } else if (work?.kind === 'deposit') {
      // A small tossing motion in time with the beat, as each item flies to the site.
      const ph = work.phase;
      swing = -1.2 - Math.sin(ph * Math.PI) * 1.0;
      lean = 0.04;
    } else {
      swing = legSwing * 0.8; // arms swing opposite to the legs while walking
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

  dispose(): void {
    this.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
}

function smooth(t: number) {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}
