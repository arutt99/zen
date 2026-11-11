// The deer (plan 4.3), in the caretaker's proportion style (src/data/characters.ts, A4): a warm brown
// body with pale spots and belly, slim legs, big ears, a short white tail. Legs step while walking, the
// head dips to graze and the body lowers to rest. Movement comes from sim/animals.ts.
import * as THREE from 'three';
import { damp } from '../core/util';
import { DEER, type CharacterStyleId } from '../data/characters';
import type { Wanderer } from '../sim/animals';
import { inked, Mats } from './materials';
import { MB } from './mb';
import { contactBlob } from './contact';

const COAT: [number, number] = [0x8a5a36, 0xb07a4a];
const PALE = 0xf0e2c8;
const DARK = 0x2a201c;

export class DeerView {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private legs: THREE.Group[] = [];
  private gait = 0;
  private graze = 0;
  private rest = 0;
  private shown = 0;

  constructor(readonly sim: Wanderer, style: CharacterStyleId, private heightAt: (x: number, z: number) => number) {
    const p = DEER[style];
    const mesh = (g: THREE.BufferGeometry) => {
      const m = inked(new THREE.Mesh(g, Mats.figure), 'figure');
      m.castShadow = true;
      return m;
    };
    const legLen = p.shoulder - p.bodyR * 0.6;
    const b = new MB();
    b.sphere(p.bodyR, COAT, { s: [0.95, 0.9, p.body / p.bodyR / 1.6] }, 14, 10);
    b.sphere(p.bodyR * 0.8, PALE, { p: [0, -p.bodyR * 0.35, 0], s: [0.85, 0.6, p.body / p.bodyR / 1.9] }, 12, 8);
    for (let i = 0; i < 7; i++) {
      const a = (i % 2 ? 0.5 : -0.5) + (i - 3) * 0.05;
      b.sphere(p.bodyR * 0.09, PALE, { p: [Math.sin(a) * p.bodyR * 0.93, p.bodyR * 0.45, (i - 3) * p.body * 0.1], s: [0.6, 0.5, 1] }, 6, 4);
    }
    b.cone(p.bodyR * 0.25, p.bodyR * 0.5, PALE, { p: [0, p.bodyR * 0.35, -p.body * 0.6], r: [-2.2, 0, 0] }, 6);
    this.body.add(mesh(b.build()));
    this.body.position.y = p.shoulder;

    // Head on a neck, pivoting at the front of the body so it can dip to graze.
    this.head.position.set(0, p.bodyR * 0.3, p.body * 0.45);
    const h = new MB();
    h.cyl(p.bodyR * 0.32, p.bodyR * 0.42, p.neck, COAT, { p: [0, p.neck * 0.45, p.neck * 0.18], r: [0.4, 0, 0] }, 8);
    const hy = p.neck * 0.9, hz = p.neck * 0.42;
    h.sphere(p.head, COAT, { p: [0, hy, hz], s: [0.9, 0.95, 1.1] }, 12, 10);
    // A long, pale muzzle with a dark nose: what makes it read as a deer, not a bear.
    h.sphere(p.head * 0.62, COAT, { p: [0, hy - p.head * 0.22, hz + p.head * 0.85], s: [0.72, 0.7, 1.35] }, 10, 8);
    h.sphere(p.head * 0.42, PALE, { p: [0, hy - p.head * 0.42, hz + p.head * 1.05], s: [0.8, 0.6, 1.2] }, 8, 6);
    h.sphere(p.head * 0.14, DARK, { p: [0, hy - p.head * 0.18, hz + p.head * 1.62] }, 6, 4);
    for (const side of [-1, 1]) {
      // Tall, leaf-shaped ears angled up and back, pale inside.
      h.sphere(p.head * 0.5, COAT, { p: [side * p.head * 0.7, hy + p.head * 0.95, hz - p.head * 0.25], s: [0.38, 1.1, 0.2], r: [-0.3, 0, side * -0.45] }, 8, 6);
      h.sphere(p.head * 0.32, PALE, { p: [side * p.head * 0.7, hy + p.head * 0.95, hz - p.head * 0.18], s: [0.3, 0.95, 0.12], r: [-0.3, 0, side * -0.45] }, 6, 5);
      h.sphere(p.head * 0.13, DARK, { p: [side * p.head * 0.62, hy + p.head * 0.12, hz + p.head * 0.62] }, 6, 4);
    }
    this.head.add(mesh(h.build()));
    this.body.add(this.head);

    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
      const g = new THREE.Group();
      g.position.set(x * p.bodyR * 0.5, -p.bodyR * 0.3, z * p.body * 0.36);
      const l = new MB();
      l.cyl(p.leg * 1.3, p.leg, legLen, COAT, { p: [0, -legLen / 2, 0] }, 6);
      l.cyl(p.leg * 1.05, p.leg * 1.1, 0.05, DARK, { p: [0, -legLen + 0.025, 0] }, 6);
      g.add(mesh(l.build()));
      this.body.add(g);
      this.legs.push(g);
    }
    this.root.add(this.body);
    const blob = contactBlob(0.95);
    if (blob) this.root.add(blob);
    this.root.scale.setScalar(0.001);
    this.root.position.set(sim.x, heightAt(sim.x, sim.z), sim.z);
  }

  update(dt: number): void {
    const s = this.sim;
    this.shown = damp(this.shown, 1, 1.5, dt); // arrives by fading up in size, never pops
    this.root.scale.setScalar(Math.max(0.001, this.shown));
    this.root.position.set(s.x, this.heightAt(s.x, s.z) - 0.04, s.z);
    let d = s.heading - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 4);
    this.gait += dt * s.speed * 7;
    const w = Math.min(1, s.speed / 0.6);
    this.legs.forEach((g, i) => { g.rotation.x = Math.sin(this.gait + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 * w; });
    this.graze = damp(this.graze, s.act === 'graze' ? 1 : 0, 2, dt);
    this.rest = damp(this.rest, s.act === 'rest' ? 1 : 0, 1.2, dt);
    this.head.rotation.x = this.graze * 1.0 + Math.sin(this.gait * 0.5) * 0.04 * w + (this.graze > 0.5 ? Math.sin(performance.now() * 0.004) * 0.05 : 0);
    this.root.position.y -= this.rest * 0.25;
    for (const g of this.legs) g.scale.y = 1 - this.rest * 0.45;
  }
}
