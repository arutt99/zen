// Gather nodes that visibly deplete with every unit and regrow gradually (plan 3.1, pillar 6).
// A tree is a stump, an upper trunk and canopy puffs; each chop notches the trunk and takes one puff,
// the last takes the trunk down to the stump. A boulder is a core rock with chunks; each tap takes a
// chunk and shrinks the core. Every change eases in; nothing pops. Gentle: no falling or shattering.
import * as THREE from 'three';
import { damp } from '../core/util';
import type { GatherNode } from '../sim/nodes';
import { inked, Mats } from './materials';
import { MB } from './mb';

const BARK: [number, number] = [0x4a3426, 0x7a5a40];
const LEAF: [number, number] = [0x4f8a3c, 0xa8c866];
const STONE: [number, number] = [0x6c6a68, 0xaeab9c];
const CUT = 0xd9c39d;

interface Part {
  obj: THREE.Object3D;
  /** Shown scale right now, and the scale it eases to. */
  s: number;
  target: number;
  /** The scale it has when fully shown. */
  full: THREE.Vector3;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = inked(new THREE.Mesh(geo, mat));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Shared geometry, built once (trees and boulders repeat). */
let geos: ReturnType<typeof buildGeos> | null = null;
function buildGeos() {
  const stump = new MB()
    .cyl(0.3, 0.38, 0.5, BARK, { p: [0, 0.25, 0], wobble: 0.03 }, 9)
    .cyl(0.27, 0.27, 0.03, CUT, { p: [0, 0.505, 0] }, 9)
    .cone(0.2, 0.4, BARK[0], { p: [0.32, 0.12, 0.05], r: [0, 0, -0.9] }, 5)
    .cone(0.18, 0.36, BARK[0], { p: [-0.25, 0.1, 0.22], r: [0.7, 0, 0.6] }, 5)
    .build();
  // The trunk above the stump, with its base at y = 0 so it shrinks down into the stump.
  const upper = new MB()
    .cyl(0.17, 0.27, 2.1, BARK, { p: [0, 1.05, 0], r: [0.04, 0, 0.03], wobble: 0.03 }, 8, 3)
    .cyl(0.06, 0.1, 0.9, BARK, { p: [0.38, 1.75, 0.05], r: [0, 0, -0.85] }, 5)
    .cyl(0.05, 0.09, 0.8, BARK, { p: [-0.34, 1.9, -0.1], r: [0.15, 0, 0.8] }, 5)
    .build();
  const puff = new MB().ico(1, LEAF, { wobble: 0.12, wobbleFreq: 1.6, flat: false, puff: 0.75 }, 2).build();
  const notch = new MB().box(0.16, 0.12, 0.1, [0xb89a6e, 0xe6d3ad], { r: [0, 0, 0.5] }).build();
  const rock = new MB().ico(1, STONE, { s: [1.1, 0.78, 1], wobble: 0.12 }, 1).build();
  const chunk = new MB().ico(0.5, STONE, { s: [1, 0.75, 1], wobble: 0.06 }, 1).build();
  // Gatherable boulders are mossy (plan 3.1), so they read apart from the bare decor rocks.
  const moss = new MB().ico(1, [0x5f7f3f, 0x93b25e], { s: [0.95, 0.32, 0.9], wobble: 0.08, flat: false, puff: 0.5 }, 1).build();
  return { stump, upper, puff, notch, rock, chunk, moss };
}

export abstract class NodeView {
  readonly root = new THREE.Group();
  protected parts: Part[] = [];
  private shake = 0;

  constructor(readonly node: GatherNode, y: number, rot: number) {
    this.root.position.set(node.x, y, node.z);
    this.root.rotation.y = rot;
    geos ??= buildGeos();
  }

  protected part(obj: THREE.Object3D, parent: THREE.Object3D = this.root): Part {
    parent.add(obj);
    const p = { obj, s: 1, target: 1, full: obj.scale.clone() };
    this.parts.push(p);
    return p;
  }

  /** Called on every unit gathered from this node. */
  hit(): void {
    this.shake = 1;
  }

  /** World position of the part that just came off, for particles. */
  abstract burstAt(out: THREE.Vector3): THREE.Vector3;

  /** Sets each part's target from the node's current state. */
  protected abstract targets(): void;

  update(dt: number, time: number): void {
    this.targets();
    for (const p of this.parts) {
      // Shrinking is a touch quicker than growing, so a swing reads at once and regrowth feels slow.
      p.s = damp(p.s, p.target, p.target < p.s ? 7 : 2.2, dt);
      const s = p.s < 0.004 ? 0 : p.s;
      p.obj.visible = s > 0;
      p.obj.scale.copy(p.full).multiplyScalar(s);
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    const k = this.shake * this.shake;
    this.root.rotation.x = Math.sin(time * 38) * 0.035 * k;
    this.root.rotation.z = Math.cos(time * 33) * 0.035 * k;
  }

  /** Snap every part to its target (on load, so a fresh island doesn't grow in). */
  settle(): void {
    this.targets();
    for (const p of this.parts) p.s = p.target;
  }
}

export class TreeView extends NodeView {
  private upper: Part;
  private canopy = new THREE.Group();
  private puffs: Part[] = [];
  private core: Part;
  private notches: Part[] = [];

  constructor(node: GatherNode, y: number, rot: number) {
    super(node, y, rot);
    const g = geos!;
    this.root.add(mesh(g.stump, Mats.std));
    const upperObj = new THREE.Group();
    upperObj.position.y = 0.5;
    upperObj.add(mesh(g.upper, Mats.std));
    this.upper = this.part(upperObj);
    this.canopy.position.y = 2.3;
    upperObj.add(this.canopy);
    // The core puff goes last, with the trunk; the others go one per unit before it.
    const core = mesh(g.puff, Mats.stdFoliage);
    core.scale.setScalar(1.25);
    core.position.set(0, 0.55, 0);
    this.core = this.part(core, this.canopy);
    const outer: [number, number, number, number][] = [
      [0.95, 0.2, 0.3, 0.95], [-0.9, 0.3, -0.25, 0.95], [0.15, 0.15, -0.95, 0.85], [-0.2, 0.2, 0.9, 0.85], [0.2, 1.35, 0.05, 0.8],
    ];
    for (let i = 0; i < node.def.units - 1; i++) {
      const [x, yy, z, r] = outer[i % outer.length]!;
      const m = mesh(g.puff, Mats.stdFoliage);
      m.position.set(x, yy + 0.55, z);
      m.scale.setScalar(r);
      this.puffs.push(this.part(m, this.canopy));
    }
    for (let i = 0; i < node.def.units - 1; i++) {
      const m = mesh(g.notch, Mats.std);
      const a = i * 1.9 + 0.4;
      m.position.set(Math.sin(a) * 0.2, 0.15 + i * 0.13, Math.cos(a) * 0.2);
      m.rotation.y = a;
      const p = this.part(m, upperObj);
      p.s = p.target = 0;
      this.notches.push(p);
    }
    this.settle();
    this.canopy.scale.setScalar(1);
  }

  protected targets(): void {
    const n = this.node;
    const u = n.units;
    this.upper.target = u >= 1 ? 1 : 0;
    this.core.target = u >= 1 ? 1 : 0;
    this.puffs.forEach((p, i) => { p.target = i < u - 1 ? 1 : 0; });
    // Notches are cuts from chopping; a regrowing sapling has none.
    const cuts = n.phase === 'ready' ? n.def.units - u : 0;
    this.notches.forEach((p, i) => { p.target = i < cuts ? 1 : 0; });
  }

  override update(dt: number, time: number): void {
    super.update(dt, time);
    // The whole crown shrinks a little as it thins, and a regrowing tree starts small.
    this.canopy.scale.setScalar(damp(this.canopy.scale.x, 0.72 + 0.28 * this.node.fullness, 2.5, dt));
  }

  burstAt(out: THREE.Vector3): THREE.Vector3 {
    const u = this.node.units;
    const src = u >= 1 ? this.puffs[u - 1]?.obj ?? this.core.obj : this.core.obj;
    return src.getWorldPosition(out);
  }
}

export class BoulderView extends NodeView {
  private core: Part;
  private chunks: Part[] = [];

  constructor(node: GatherNode, y: number, rot: number) {
    super(node, y, rot);
    const g = geos!;
    const core = mesh(g.rock, Mats.std);
    core.position.y = 0.42;
    core.scale.set(0.95, 0.95, 0.95);
    const moss = mesh(g.moss, Mats.std);
    moss.position.set(-0.05, 0.62, 0.05);
    moss.scale.setScalar(0.82);
    core.add(moss);
    this.core = this.part(core);
    const spots: [number, number, number, number][] = [
      [0.7, 0.75, 0.2, 0.62], [-0.55, 0.8, -0.3, 0.58], [0.05, 1.05, 0.15, 0.55], [0.45, 0.35, 0.75, 0.5], [-0.6, 0.3, 0.6, 0.48],
    ];
    for (let i = 0; i < node.def.units - 1; i++) {
      const [x, yy, z, s] = spots[i % spots.length]!;
      const m = mesh(g.chunk, Mats.std);
      m.position.set(x, yy, z);
      m.rotation.set(i, i * 2.3, 0);
      m.scale.setScalar(s * 1.5);
      this.chunks.push(this.part(m));
    }
    this.settle();
  }

  protected targets(): void {
    const u = this.node.units;
    this.chunks.forEach((p, i) => { p.target = i < u - 1 ? 1 : 0; });
    // The core never vanishes: an emptied boulder is a low, mossy-to-be stone it grows back from.
    this.core.target = 0.45 + 0.55 * this.node.fullness;
  }

  burstAt(out: THREE.Vector3): THREE.Vector3 {
    const u = this.node.units;
    return (this.chunks[u - 1]?.obj ?? this.core.obj).getWorldPosition(out);
  }
}

export function nodeView(node: GatherNode, y: number, rot: number): NodeView {
  return node.kind === 'tree' ? new TreeView(node, y, rot) : new BoulderView(node, y, rot);
}
