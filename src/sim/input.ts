// The game reads exactly two things from the player (plan 10, Phase 0):
// one move vector and one context action. UI code turns keys, sticks and touches into this.

export interface MoveInput {
  /** Desired movement on the ground plane, length 0..1. +x is east/right, +z is south/toward camera. */
  x: number;
  z: number;
}

export interface PlayerIntent {
  move: MoveInput;
  /** True for exactly one frame when the context action was pressed. */
  contextPressed: boolean;
}

/** Combine several move sources: the strongest one wins, the result is clamped to length 1. */
export function combineMoves(...moves: MoveInput[]): MoveInput {
  let best: MoveInput = { x: 0, z: 0 };
  let bestLen = 0;
  for (const m of moves) {
    const len = Math.hypot(m.x, m.z);
    if (len > bestLen) { best = m; bestLen = len; }
  }
  if (bestLen > 1) return { x: best.x / bestLen, z: best.z / bestLen };
  return { x: best.x, z: best.z };
}

/** Radial dead zone with rescale, so small stick drift doesn't move the caretaker. */
export function applyDeadZone(m: MoveInput, dead = 0.15): MoveInput {
  const len = Math.hypot(m.x, m.z);
  if (len <= dead) return { x: 0, z: 0 };
  const scaled = Math.min(1, (len - dead) / (1 - dead));
  return { x: (m.x / len) * scaled, z: (m.z / len) * scaled };
}
