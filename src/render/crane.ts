// The crane (Phase 4, plan 4.2, 4.3): the bamboo grove's animal friend, arriving once the wind shrine is
// restored. Chibi proportions to match the caretaker and the deer (A4): a round white body, black tail
// plumes, a long neck (black at the throat), a small red crown, a pale bill and long dark legs. It wades
// the spring pool ('walk'), dips its bill into the water ('graze'), and stands a long while on one leg
// with its neck drawn in ('rest'). Movement comes from sim/animals.ts, as for the deer.
import * as THREE from 'three';
import { damp } from '../core/util';
import type { Wanderer } from '../sim/animals';
import { contactBlob } from './contact';
import { inked, Mats } from './materials';
import { MB } from './mb';

const WHITE: [number, number] = [0xd8dcd8, 0xfbfaf4];
const BLACK: [number, number] = [0x1e2224, 0x3a3e40];
const RED = 0xc8402e;
const BILL: [number, number] = [0x9a8a5a, 0xd8cc98];
const LEG: [number, number] = [0x2a2a28, 0x4a4a44];

/** Hip height, leg length, body size (metres); the crane stands about 1.2 m to its crown. */
const HIP = 0.62, BODY = 0.3;

export class CraneView {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private neck = new THREE.Group();
  private legs: THREE.Group[] = [];
  private gait = 0;
  private graze = 0;
  private rest = 0;
  private shown = 0;

  constructor(readonly sim: Wanderer, private heightAt: (x: number, z: number) => number) {
    const mesh = (g: THREE.BufferGeometry) => {
      const m = inked(new THREE.Mesh(g, Mats.std), 'figure');
      m.castShadow = true;
      return m;
    };
    const b = new MB();
    b.sphere(BODY, WHITE, { s: [0.85, 0.8, 1.25] }, 14, 10);
    // Folded wings, a touch greyer along the top, and the black plumes drooping over the tail.
    for (const side of [-1, 1]) b.sphere(BODY * 0.75, [0xc8ccc8, 0xeceee8], { p: [side * BODY * 0.42, BODY * 0.12, -BODY * 0.1], s: [0.35, 0.7, 1.35], r: [0, side * 0.08, 0] }, 10, 8);
    for (let i = 0; i < 4; i++) b.sphere(BODY * 0.32, BLACK, { p: [(i - 1.5) * BODY * 0.18, -BODY * 0.05, -BODY * 1.15], s: [0.55, 0.55, 1.6], r: [0.5, 0, (i - 1.5) * 0.12] }, 8, 6);
    this.body.add(mesh(b.build()));
    this.body.position.y = HIP;

    // The neck rises from the front of the body and bends forward to the head; it pivots at its base.
    this.neck.position.set(0, BODY * 0.35, BODY * 0.85);
    const n = new MB();
    n.cyl(0.045, 0.07, 0.42, WHITE, { p: [0, 0.18, 0.02], r: [0.25, 0, 0] }, 8);
    n.cyl(0.04, 0.05, 0.22, BLACK, { p: [0, 0.44, 0.1], r: [0.45, 0, 0] }, 8);
    n.sphere(0.085, WHITE, { p: [0, 0.58, 0.16], s: [0.9, 0.95, 1.1] }, 10, 8);
    n.sphere(0.05, BLACK, { p: [0, 0.56, 0.2], s: [1.05, 0.9, 0.9] }, 8, 6);
    n.sphere(0.035, RED, { p: [0, 0.66, 0.14], s: [1, 0.5, 1.2] }, 8, 5);
    n.cone(0.025, 0.2, BILL, { p: [0, 0.57, 0.33], r: [Math.PI / 2 + 0.08, 0, 0] }, 6);
    for (const side of [-1, 1]) n.sphere(0.014, 0x111111, { p: [side * 0.055, 0.6, 0.2] }, 5, 4);
    this.neck.add(mesh(n.build()));
    this.body.add(this.neck);

    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * BODY * 0.3, -BODY * 0.35, 0.02);
      const l = new MB();
      l.cyl(0.016, 0.02, HIP - BODY * 0.3, LEG, { p: [0, -(HIP - BODY * 0.3) / 2, 0] }, 5);
      for (const a of [-0.5, 0, 0.5]) l.cyl(0.008, 0.008, 0.12, LEG, { p: [Math.sin(a) * 0.05, -(HIP - BODY * 0.3) + 0.005, Math.cos(a) * 0.05], r: [Math.PI / 2, a, 0] }, 3);
      g.add(mesh(l.build()));
      this.body.add(g);
      this.legs.push(g);
    }
    this.root.add(this.body);
    const blob = contactBlob(0.6);
    if (blob) this.root.add(blob);
    this.root.scale.setScalar(0.001);
    this.root.position.set(sim.x, heightAt(sim.x, sim.z), sim.z);
  }

  update(dt: number): void {
    const s = this.sim;
    this.shown = damp(this.shown, 1, 1.5, dt);
    this.root.scale.setScalar(Math.max(0.001, this.shown));
    // Wading: in the shallows it stands a little lower (never below the water line).
    this.root.position.set(s.x, Math.max(-0.25, this.heightAt(s.x, s.z) - 0.03), s.z);
    let d = s.heading - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 3);
    // A slow, high-stepping walk.
    this.gait += dt * s.speed * 6;
    const w = Math.min(1, s.speed / 0.5);
    this.legs.forEach((g, i) => { g.rotation.x = Math.sin(this.gait + i * Math.PI) * 0.5 * w; });
    this.graze = damp(this.graze, s.act === 'graze' ? 1 : 0, 1.6, dt);
    this.rest = damp(this.rest, s.act === 'rest' ? 1 : 0, 1.0, dt);
    // Graze: the neck swings down to the water, with a small peck now and then.
    const peck = this.graze > 0.6 ? Math.max(0, Math.sin(performance.now() * 0.002)) ** 8 * 0.15 : 0;
    this.neck.rotation.x = this.graze * 1.45 + peck - this.rest * 0.35 + Math.sin(this.gait) * 0.05 * w;
    this.neck.scale.y = 1 - this.rest * 0.2;
    // Rest: one leg drawn up under the body.
    const lifted = this.legs[1]!;
    lifted.rotation.x += this.rest * -1.1;
    lifted.scale.y = 1 - this.rest * 0.45;
    this.body.rotation.x = this.graze * 0.25;
  }
}
