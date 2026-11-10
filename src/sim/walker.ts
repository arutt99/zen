// Headless caretaker movement: position, velocity and circular collisions that slide.
// Tuning lives in src/data/feel.ts. 8-way on keys, analog on sticks and touch.

import { WALKER, type WalkerTuning } from '../data/feel';
import type { MoveInput } from './input';

export type { WalkerTuning };
export const DEFAULT_WALKER: WalkerTuning = WALKER;

export interface Blocker { x: number; z: number; r: number }

export interface WalkArea {
  /** False where the ground can't be stood on (water, the island rim, cliffs). */
  walkable(x: number, z: number): boolean;
  /** Circles the walker can't enter (trunks, rocks, props). */
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
    // Reversing brakes harder than it accelerates, so turning around feels crisp, not floaty.
    const reversing = pushing && this.vx * tx + this.vz * tz < 0;
    const maxDelta = (pushing ? t.accel * (reversing ? t.turnBoost : 1) : t.decel) * dt;
    if (dlen <= maxDelta) { this.vx = tx; this.vz = tz; }
    else { this.vx += (dx / dlen) * maxDelta; this.vz += (dz / dlen) * maxDelta; }

    // Move one axis at a time so the walker slides along water edges and cliffs instead of sticking.
    const nx = this.x + this.vx * dt;
    if (area.walkable(nx, this.z)) this.x = nx;
    else this.vx = 0;
    const nz = this.z + this.vz * dt;
    if (area.walkable(this.x, nz)) this.z = nz;
    else this.vz = 0;
    this.resolve(area);
    if (this.speed > 0.2) this.heading = Math.atan2(this.vx, this.vz);
  }

  private resolve(area: WalkArea): void {
    const r = this.tuning.radius;
    const px = this.x, pz = this.z;
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
    // Never let a push-out shove the walker into water or off the rim.
    if (!area.walkable(this.x, this.z)) { this.x = px; this.z = pz; }
  }
}
