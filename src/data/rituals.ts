// Rituals (plan 3.5): short, satisfying, unrewarded. Each belongs to a finished building and shows the
// context button when the caretaker is near. Nothing is saved and nothing is counted (pillar 1).
import type { BuildingId } from './buildings';

export type RitualId = 'ring_bell' | 'rake_gravel' | 'light_lanterns' | 'make_tea';

export interface RitualDef {
  id: RitualId;
  /** The context button's label. */
  label: string;
  /** The building it belongs to; the ritual appears once that building is complete. */
  building: BuildingId;
  /** Where to stand, in the building's local space (+z faces the camera side), and how close. */
  at: { x: number; z: number };
  radius: number;
  /** Seconds the caretaker is busy (the HUD stays out of the way meanwhile). */
  seconds: number;
  /**
   * Only offered during this part of the day (fractions of the day, from → to; wraps past midnight).
   * Lanterns at dusk: rituals that fit the time of day appear on their own (plan 3.5).
   */
  during?: [number, number];
}

export const RITUALS: Record<RitualId, RitualDef> = {
  ring_bell: { id: 'ring_bell', label: 'Ring', building: 'bell_tower', at: { x: 0, z: 1.9 }, radius: 1.9, seconds: 2.4 },
  rake_gravel: { id: 'rake_gravel', label: 'Rake', building: 'gravel_garden', at: { x: 2.9, z: 0.6 }, radius: 2.0, seconds: 4.2 },
  // From dusk (~19:00) to dawn (~05:30): the path lanterns stay dark until someone lights them.
  light_lanterns: { id: 'light_lanterns', label: 'Light', building: 'meditation_hall', at: { x: -3.3, z: 3.6 }, radius: 1.8, seconds: 2.6, during: [0.79, 0.23] },
  // Phase 4 (plan 9.6): the tea ritual. Kneel at the tea house's bench; the tea set steams, the water pipe
  // tocks. Any input stands up early, like sitting.
  make_tea: { id: 'make_tea', label: 'Tea', building: 'tea_house', at: { x: 1.2, z: 2.3 }, radius: 1.9, seconds: 9 },
};

/** True when `t` (fraction of the day) is inside `during` (which may wrap past midnight). */
export function duringTime(during: [number, number] | undefined, t: number): boolean {
  if (!during) return true;
  const [a, b] = during;
  return a <= b ? t >= a && t < b : t >= a || t < b;
}
