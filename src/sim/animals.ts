// Animal wandering (plan 4.3), headless: walk to a spot near home, graze or rest a while, pick another
// spot. Keeps a gentle distance from a moving caretaker. Residents can reuse this later (plan 4.3).
// No saved state: animals are placed from the facts on load (plan 9.2).
import type { AnimalDef } from '../data/animals';
import { makeRng, type Rng } from '../core/util';

export type AnimalAct = 'walk' | 'graze' | 'rest';

export class Wanderer {
  x: number;
  z: number;
  heading = 0;
  speed = 0;
  act: AnimalAct = 'graze';
  /** Seconds left in the current act (graze or rest). */
  private timer: number;
  private tx: number;
  private tz: number;
  private rng: Rng;

  constructor(readonly def: AnimalDef, private walkable: (x: number, z: number) => boolean, seed: number, arriving: boolean) {
    this.rng = makeRng(seed);
    const start = arriving ? def.enterFrom : this.pickSpot();
    this.x = start.x;
    this.z = start.z;
    this.timer = this.lingerTime();
    const t = this.pickSpot();
    this.tx = t.x;
    this.tz = t.z;
    if (arriving) this.act = 'walk';
  }

  private lingerTime() {
    const [a, b] = this.def.linger;
    return a + this.rng() * (b - a);
  }

  /** While the caretaker sits, where they sit. */
  private near: { x: number; z: number } | null = null;

  /** A walkable spot inside the home circle (or, now and then, a calm distance from a sitting caretaker). */
  private pickSpot(): { x: number; z: number } {
    const h = this.def.home;
    const n = this.near;
    if (n && Math.hypot(n.x - h.x, n.z - h.z) < h.r + 8 && this.rng() < 0.75) {
      for (let i = 0; i < 20; i++) {
        // On the animal's own side of the sitter, so its walk there never passes through them.
        const a = Math.atan2((this.z ?? h.z) - n.z, (this.x ?? h.x) - n.x) + (this.rng() - 0.5) * 1.8;
        const r = this.def.shyRadius + 0.6 + this.rng() * 1.6;
        const x = n.x + Math.cos(a) * r, z = n.z + Math.sin(a) * r;
        if (this.walkable(x, z)) return { x, z };
      }
    }
    for (let i = 0; i < 40; i++) {
      const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * h.r;
      const x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r;
      if (this.walkable(x, z)) return { x, z };
    }
    return { x: this.x ?? h.x, z: this.z ?? h.z };
  }

  /**
   * @param caretaker where the caretaker is; `sitting` makes the animal drift closer more often
   * (plan 3.5: sitting makes animals approach), never right up to them.
   */
  update(dt: number, caretaker: { x: number; z: number; speed: number; sitting?: boolean }): void {
    if (!(dt > 0)) return;
    this.near = caretaker.sitting ? caretaker : null;
    // Shy, not afraid: if the caretaker walks close, amble a few steps away.
    const cdx = this.x - caretaker.x, cdz = this.z - caretaker.z;
    const cd = Math.hypot(cdx, cdz);
    if (cd < this.def.shyRadius && caretaker.speed > 0.5 && this.act !== 'walk') {
      const away = 3 / Math.max(cd, 0.3);
      const nx = this.x + cdx * away, nz = this.z + cdz * away;
      if (this.walkable(nx, nz)) { this.tx = nx; this.tz = nz; this.act = 'walk'; }
    }
    if (this.act === 'walk') {
      const dx = this.tx - this.x, dz = this.tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        this.act = this.rng() < 0.7 ? 'graze' : 'rest';
        this.timer = this.lingerTime() * (this.act === 'rest' ? 1.6 : 1);
        this.speed = 0;
        return;
      }
      this.speed = Math.min(this.def.walkSpeed, this.speed + dt * 1.5);
      const step = Math.min(d, this.speed * dt);
      const nx = this.x + (dx / d) * step, nz = this.z + (dz / d) * step;
      if (this.walkable(nx, nz)) { this.x = nx; this.z = nz; } else { const t = this.pickSpot(); this.tx = t.x; this.tz = t.z; }
      this.heading = Math.atan2(dx, dz);
      return;
    }
    this.speed = Math.max(0, this.speed - dt * 2);
    this.timer -= dt;
    if (this.timer <= 0) {
      const t = this.pickSpot();
      this.tx = t.x;
      this.tz = t.z;
      this.act = 'walk';
    }
  }
}
