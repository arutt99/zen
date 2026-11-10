// Placeholder caretaker (Phase 0): a capsule body, head, hair bun and a basket so facing reads.
// Built with Lanternfall's model builder (MB) and painted material, so it gets the same brush
// texture and ink outline as everything else. Phase 2 replaces it with the real model.

import * as THREE from 'three';
import { inked, Mats } from './materials';
import { MB } from './mb';

export class CaretakerView {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private bob = 0;

  constructor() {
    this.root.name = 'caretaker';
    const m = new MB();
    m.add(new THREE.CapsuleGeometry(0.3, 0.55, 6, 14), [0xe2d6bd, 0xf2e8d2], { p: [0, 0.6, 0] });
    m.sphere(0.3, 0xf1d3b5, { p: [0, 1.28, 0] }, 16, 12);
    m.sphere(0.32, 0x3a2e28, { p: [0, 1.36, -0.05], s: [1, 0.82, 1] }, 14, 10);
    m.sphere(0.14, 0x3a2e28, { p: [0, 1.62, -0.12] }, 10, 8);
    m.cyl(0.24, 0.18, 0.42, [0x9a7a55, 0xd9c39d], { p: [0, 0.82, -0.34] }, 12);
    m.cyl(0.31, 0.31, 0.06, 0x846b50, { p: [0, 0.52, 0] }, 14);
    const mesh = inked(new THREE.Mesh(m.build(), Mats.std));
    mesh.castShadow = true;
    this.body.add(mesh);
    this.root.add(this.body);
  }

  update(dt: number, x: number, y: number, z: number, heading: number, speed: number): void {
    this.root.position.set(x, y, z);
    // Turn smoothly toward the heading, taking the short way around.
    let d = heading - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 12);
    this.bob += dt * (4 + speed * 2.5);
    const amp = Math.min(1, speed / 3) * 0.05;
    this.body.position.y = Math.abs(Math.sin(this.bob)) * amp;
    this.body.rotation.z = Math.sin(this.bob) * amp * 0.6;
  }
}
