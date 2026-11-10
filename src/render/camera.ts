// Follow camera with damping and two zoom presets (plan 7.2). No free rotation in the first version.
// The angle and heights come from the chosen camera (art decision point A2, decided: camera A,
// src/data/feel.ts). A completion moment eases the camera out for a few seconds (plan 3.3).
import * as THREE from 'three';
import { damp } from '../core/util';
import { CAMERA_OPTIONS, COMPLETION_CAMERA, type CameraOption } from '../data/feel';

export class FollowCamera {
  zoom = 0;
  option: CameraOption = CAMERA_OPTIONS[0]!;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private wantLook = new THREE.Vector3();
  private wantPos = new THREE.Vector3();
  private dist: number;
  private height: number;
  private first = true;
  /** Seconds left of the completion ease-out, and where it looks. */
  private moment = 0;
  private momentAt = new THREE.Vector3();
  /** Extra pull-back while sitting (plan 3.5), 0..1. */
  sitting = false;
  private sitK = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {
    this.dist = this.option.zooms[0].distance;
    this.height = this.option.zooms[0].height;
  }

  setOption(id: string): void {
    this.option = CAMERA_OPTIONS.find((c) => c.id === id) ?? CAMERA_OPTIONS[0]!;
  }

  toggleZoom(dir?: 1 | -1): void {
    const n = this.option.zooms.length;
    this.zoom = dir === undefined ? (this.zoom + 1) % n : Math.max(0, Math.min(n - 1, this.zoom + dir));
  }

  /** Ease out to show a finished building and the land around it. */
  celebrate(at: THREE.Vector3): void {
    this.moment = COMPLETION_CAMERA.seconds;
    this.momentAt.copy(at);
  }

  /** Vertical field of view for this option, widened on narrow screens as the engine did. */
  fovFor(aspect: number): number {
    const f = this.option.fov;
    return aspect < 1.6 ? f * Math.min(1.35, 1.6 / aspect) : f;
  }

  update(dt: number, target: THREE.Vector3, vx: number, vz: number): void {
    const z = this.option.zooms[this.zoom]!;
    this.moment = Math.max(0, this.moment - dt);
    // Ease in and out of the moment over its first and last second.
    const m = Math.min(1, this.moment, COMPLETION_CAMERA.seconds - this.moment);
    const mk = this.moment > 0 ? m * m * (3 - 2 * m) : 0;
    this.sitK = damp(this.sitK, this.sitting ? 1 : 0, 0.8, dt);
    const pull = 1 + (COMPLETION_CAMERA.pullBack - 1) * mk + 0.3 * this.sitK;
    this.dist = damp(this.dist, z.distance * pull, 4, dt);
    this.height = damp(this.height, z.height * pull, 4, dt);
    const lx = THREE.MathUtils.lerp(target.x + vx * z.lookAhead, this.momentAt.x, mk * 0.6);
    const lz = THREE.MathUtils.lerp(target.z + vz * z.lookAhead, this.momentAt.z, mk * 0.6);
    this.wantLook.set(lx, target.y + 0.8, lz);
    this.wantPos.set(lx, target.y + this.height, lz + this.dist);
    if (this.first) { this.look.copy(this.wantLook); this.pos.copy(this.wantPos); this.first = false; }
    this.look.set(damp(this.look.x, this.wantLook.x, 6, dt), damp(this.look.y, this.wantLook.y, 6, dt), damp(this.look.z, this.wantLook.z, 6, dt));
    this.pos.set(damp(this.pos.x, this.wantPos.x, 5, dt), damp(this.pos.y, this.wantPos.y, 5, dt), damp(this.pos.z, this.wantPos.z, 5, dt));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    const fov = this.fovFor(this.camera.aspect);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, fov, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
