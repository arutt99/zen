// Follow camera with damping and two zoom presets (plan 7.2). No free rotation in the first version.

import * as THREE from 'three';
import { damp } from '../core/util';

export interface ZoomPreset { distance: number; height: number; lookAhead: number }

export const ZOOM_PRESETS: readonly ZoomPreset[] = [
  { distance: 13, height: 11, lookAhead: 0.4 }, // near: phone default, basket + nearby nodes readable
  { distance: 22, height: 19, lookAhead: 0.6 }, // far: see more of the valley
];

export class FollowCamera {
  zoom = 0;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private dist: number;
  private height: number;
  private first = true;

  constructor(readonly camera: THREE.PerspectiveCamera) {
    this.dist = ZOOM_PRESETS[0]!.distance;
    this.height = ZOOM_PRESETS[0]!.height;
  }

  toggleZoom(dir?: 1 | -1): void {
    const n = ZOOM_PRESETS.length;
    this.zoom = dir === undefined ? (this.zoom + 1) % n : Math.max(0, Math.min(n - 1, this.zoom + dir));
  }

  update(dt: number, target: THREE.Vector3, vx: number, vz: number): void {
    const z = ZOOM_PRESETS[this.zoom]!;
    this.dist = damp(this.dist, z.distance, 4, dt);
    this.height = damp(this.height, z.height, 4, dt);
    const lx = target.x + vx * z.lookAhead, lz = target.z + vz * z.lookAhead;
    const wantLook = new THREE.Vector3(lx, target.y + 0.8, lz);
    const wantPos = new THREE.Vector3(lx, target.y + this.height, lz + this.dist);
    if (this.first) { this.look.copy(wantLook); this.pos.copy(wantPos); this.first = false; }
    this.look.set(damp(this.look.x, wantLook.x, 6, dt), damp(this.look.y, wantLook.y, 6, dt), damp(this.look.z, wantLook.z, 6, dt));
    this.pos.set(damp(this.pos.x, wantPos.x, 5, dt), damp(this.pos.y, wantPos.y, 5, dt), damp(this.pos.z, wantPos.z, 5, dt));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
