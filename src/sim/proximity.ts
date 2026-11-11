// The one proximity rule (plan 9.4). The player has one sensor; each frame it picks ONE target by
// priority: build site > gather node > context interactable. Everything proximity-based implements
// `Proximate`. Phase 0 only has context interactables (the bench), but the rule is in place.

// Phase 4: an exit (the trail out of a place) wins over everything: walking into it always travels.
export const PRIORITY = { exit: 400, buildSite: 300, gatherNode: 200, context: 100 } as const;

export interface Proximate {
  readonly id: string;
  readonly priority: number;
  readonly radius: number;
  readonly x: number;
  readonly z: number;
  /** Automatic targets act on their own; context targets show the context button. */
  readonly kind: 'auto' | 'context';
  /** Label for the context button ("Sit", "Ring"). Only used for context targets. */
  readonly label?: string;
  isAvailable(): boolean;
  onEnter(): void;
  onTick(dt: number): void;
  onExit(): void;
}

/** Pick the target for this frame: highest priority in range, ties broken by distance. */
export function pickTarget(x: number, z: number, items: readonly Proximate[]): Proximate | null {
  let best: Proximate | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    if (!it.isAvailable()) continue;
    const d = Math.hypot(it.x - x, it.z - z);
    if (d > it.radius) continue;
    if (!best || it.priority > best.priority || (it.priority === best.priority && d < bestDist)) {
      best = it;
      bestDist = d;
    }
  }
  return best;
}

/** Tracks the current target and calls enter/tick/exit as it changes. */
export class ProximitySensor {
  current: Proximate | null = null;

  update(x: number, z: number, items: readonly Proximate[], dt: number): Proximate | null {
    const next = pickTarget(x, z, items);
    if (next !== this.current) {
      this.current?.onExit();
      this.current = next;
      next?.onEnter();
    }
    this.current?.onTick(dt);
    return this.current;
  }
}
