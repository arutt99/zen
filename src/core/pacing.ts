// Copied from Lanternfall (games/lanternfall/src/core/pacing.ts @ b282628). Unchanged.
// Frame pacing helpers: steadier frame times and stable automatic resolution.
import { clamp } from './util';

const MAX_FRAME = 0.1;
const STALL = 0.25;
const SMOOTH_FRAMES = 5;

/**
 * Averages recent frame times, so a late frame doesn't lurch everything forward.
 * The average spreads time out without losing any, so the game stays in step with the clock.
 */
export class FrameSmoother {
  private history = new Float64Array(SMOOTH_FRAMES);
  private count = 0;
  private head = 0;

  next(raw: number): number {
    // A long stall (loading, a suspended tab) shouldn't drag out over the next few frames.
    if (raw > STALL) {
      this.count = 0;
      this.head = 0;
    }
    this.history[this.head] = Math.min(MAX_FRAME, raw);
    this.head = (this.head + 1) % SMOOTH_FRAMES;
    this.count = Math.min(SMOOTH_FRAMES, this.count + 1);
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.history[i];
    return sum / this.count;
  }
}

const WINDOW = 3;
const LOW_FPS = 38;
const HIGH_FPS = 57;
const MIN_SCALE = 0.55;
const STEP_DOWN = 0.15;
const STEP_UP = 0.1;
const BASE_PATIENCE = 3;
const MAX_PATIENCE = 24;
const FAILED_RAISE = 30;
const PATIENCE_RESET = 120;

/**
 * Decides when to change render resolution. Lowering is immediate. Raising waits for sustained
 * headroom and a still camera, and each raise that doesn't hold doubles the wait, so a scene
 * near the limit settles instead of bouncing between two resolutions.
 */
export class ResolutionGovernor {
  private acc = 0;
  private frames = 0;
  private goodWindows = 0;
  private patience = BASE_PATIENCE;
  private sinceRaise = Infinity;

  reset() {
    this.acc = 0;
    this.frames = 0;
    this.goodWindows = 0;
    this.patience = BASE_PATIENCE;
    this.sinceRaise = Infinity;
  }

  /** Returns the new scale when it should change, otherwise null. */
  sample(dt: number, scale: number, canRaise: boolean): number | null {
    this.acc += dt;
    this.frames++;
    this.sinceRaise += dt;
    if (this.acc < WINDOW && this.goodWindows < this.patience) return null;
    if (this.acc >= WINDOW) {
      const fps = this.frames / this.acc;
      this.acc = 0;
      this.frames = 0;
      if (this.sinceRaise > PATIENCE_RESET) this.patience = BASE_PATIENCE;
      if (fps < LOW_FPS) {
        this.goodWindows = 0;
        if (scale <= MIN_SCALE) return null;
        if (this.sinceRaise < FAILED_RAISE) this.patience = Math.min(MAX_PATIENCE, this.patience * 2);
        return Math.max(MIN_SCALE, scale - STEP_DOWN);
      }
      this.goodWindows = fps > HIGH_FPS ? this.goodWindows + 1 : 0;
    }
    if (scale < 1 && this.goodWindows >= this.patience && canRaise) {
      this.goodWindows = 0;
      this.sinceRaise = 0;
      return clamp(scale + STEP_UP, MIN_SCALE, 1);
    }
    return null;
  }
}
