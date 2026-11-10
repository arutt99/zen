// Ambient particles: drifting blossom petals around the caretaker. Count comes from the quality tier.

import * as THREE from 'three';
import { rng } from '../core/util';

export class Petals {
  readonly points: THREE.Points;
  private vel: Float32Array;
  private readonly area = 14;

  constructor(count: number, color: string) {
    const rand = rng(5);
    const pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos.set([(rand() - 0.5) * this.area * 2, rand() * 6, (rand() - 0.5) * this.area * 2], i * 3);
      this.vel.set([0.3 + rand() * 0.4, -(0.25 + rand() * 0.3), 0.1 + rand() * 0.2], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'petals';
  }

  update(dt: number, time: number, focus: THREE.Vector3): void {
    const attr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const p = attr.array as Float32Array;
    const a = this.area;
    for (let i = 0; i < p.length; i += 3) {
      p[i] = p[i]! + (this.vel[i]! + Math.sin(time * 1.7 + i) * 0.3) * dt;
      p[i + 1] = p[i + 1]! + this.vel[i + 1]! * dt;
      p[i + 2] = p[i + 2]! + this.vel[i + 2]! * dt;
      // Wrap around the focus so petals always surround the caretaker.
      if (p[i + 1]! < 0) p[i + 1] = 6;
      if (p[i]! - focus.x > a) p[i] = p[i]! - a * 2;
      if (p[i]! - focus.x < -a) p[i] = p[i]! + a * 2;
      if (p[i + 2]! - focus.z > a) p[i + 2] = p[i + 2]! - a * 2;
      if (p[i + 2]! - focus.z < -a) p[i + 2] = p[i + 2]! + a * 2;
    }
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
