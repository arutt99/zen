// A gather node at runtime: how many units it has left and where it is in resting / regrowing.
// Not saved (plan 9.2): nodes start full on load. A half-gathered node stays half-gathered until it
// is emptied; only empty nodes regrow, one unit at a time.
import { NODE_KINDS, type NodeKindDef, type NodeKindId } from '../data/gathering';

export type NodePhase = 'ready' | 'resting' | 'regrowing';

export class GatherNode {
  readonly def: NodeKindDef;
  units: number;
  phase: NodePhase = 'ready';
  /** Seconds until the next phase step (rest ends, or the next unit grows back). */
  timer = 0;

  constructor(readonly id: string, readonly kind: NodeKindId, readonly x: number, readonly z: number) {
    this.def = NODE_KINDS[kind];
    this.units = this.def.units;
  }

  get canGather(): boolean {
    return this.phase === 'ready' && this.units > 0;
  }

  /** 0 (stump / pebble) to 1 (full). */
  get fullness(): number {
    return this.units / this.def.units;
  }

  /** Takes one unit. Returns the index of the unit taken (0 = first), or -1 if there was none. */
  take(): number {
    if (!this.canGather) return -1;
    const unit = this.def.units - this.units;
    this.units--;
    if (this.units === 0) { this.phase = 'resting'; this.timer = this.def.restSeconds; }
    return unit;
  }

  update(dt: number): void {
    if (this.phase === 'ready' || !(dt > 0)) return;
    this.timer -= dt;
    while (this.timer <= 0 && this.phase !== 'ready') {
      if (this.phase === 'resting') {
        this.phase = 'regrowing';
        this.timer += this.def.regrowSecondsPerUnit;
      } else {
        this.units++;
        if (this.units >= this.def.units) { this.units = this.def.units; this.phase = 'ready'; this.timer = 0; }
        else this.timer += this.def.regrowSecondsPerUnit;
      }
    }
  }
}
