// Headless caretaker movement: position, velocity and simple circular collisions.
// Phase 1 tunes acceleration/stopping and adds real collision shapes; this is the Phase 0 baseline.

import type { MoveInput } from './input';

export interface WalkerTuning {
  maxSpeed: number;
  accel: number;
  decel: number;
  radius: number;
}

export const DEFAULT_WALKER: WalkerTuning = { maxSpeed: 4.2, accel: 22, decel: 28, radius: 0.35 };

export interface Blocker { x: number; z: number; r: number }

export interface WalkArea {
  /** Keep the walker inside this circle (the island edge). */
  boundsRadius: number;
  /** Circles the walker can't enter (pond, rocks, trunks). */
  blockers: readonly Blocker[];
}

export class Walker {
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  /** Facing angle in radians, around +y, 0 = facing +z. */
  heading = 0;

  constructor(x: number, z: number, readonly tuning: WalkerTuning = DEFAULT_WALKER) {
    this.x = x;
    this.z = z;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  step(dt: number, move: MoveInput, area: WalkArea): void {
    if (!(dt > 0)) return; // ignore zero, negative or NaN frame times
    const t = this.tuning;
    const tx = move.x * t.maxSpeed, tz = move.z * t.maxSpeed;
    const dx = tx - this.vx, dz = tz - this.vz;
    const dlen = Math.hypot(dx, dz);
    const pushing = Math.hypot(move.x, move.z) > 0.01;
    const maxDelta = (pushing ? t.accel : t.decel) * dt;
    if (dlen <= maxDelta) { this.vx = tx; this.vz = tz; }
    else { this.vx += (dx / dlen) * maxDelta; this.vz += (dz / dlen) * maxDelta; }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.resolve(area);
    if (this.speed > 0.2) this.heading = Math.atan2(this.vx, this.vz);
  }

  private resolve(area: WalkArea): void {
    const r = this.tuning.radius;
    for (const b of area.blockers) {
      const dx = this.x - b.x, dz = this.z - b.z;
      const d = Math.hypot(dx, dz);
      const min = b.r + r;
      if (d < min) {
        const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
        this.x = b.x + nx * min;
        this.z = b.z + nz * min;
        const vn = this.vx * nx + this.vz * nz;
        if (vn < 0) { this.vx -= vn * nx; this.vz -= vn * nz; } // slide along the edge
      }
    }
    const max = area.boundsRadius - r;
    const d = Math.hypot(this.x, this.z);
    if (d > max) {
      const nx = this.x / d, nz = this.z / d;
      this.x = nx * max;
      this.z = nz * max;
      const vn = this.vx * nx + this.vz * nz;
      if (vn > 0) { this.vx -= vn * nx; this.vz -= vn * nz; }
    }
  }
}
