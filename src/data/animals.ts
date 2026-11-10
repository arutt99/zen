// Animal friends (plan 4.3) as data. They arrive because of what you build, wander, graze and rest.
// No needs, no feeding. Presence is derived from the place's restoration (sim/progress.ts).
import type { CircleArea, PlaceId } from './places';

export type AnimalId = 'deer';

export interface AnimalDef {
  id: AnimalId;
  name: string;
  place: PlaceId;
  /**
   * Arrives once the place's restoration reaches this. Phase 2 (temporary): the shelter (0.2), so the
   * deer can be seen now. Plan 4.2 ties it to the gravel garden, which Phase 3 adds; retarget then.
   */
  minRestoration: number;
  /** Where it likes to be, and where it walks in from the first time. */
  home: CircleArea;
  enterFrom: { x: number; z: number };
  walkSpeed: number;
  /** Seconds spent grazing / resting before moving on (min, max). */
  linger: [number, number];
  /** Keeps at least this far from a moving caretaker (a calm animal, not a tame one). */
  shyRadius: number;
}

export const ANIMALS: Record<AnimalId, AnimalDef> = {
  deer: {
    id: 'deer',
    name: 'Deer',
    place: 'home_valley',
    minRestoration: 0.2,
    home: { x: -9, z: -2, r: 8.5 },
    enterFrom: { x: -21, z: 8 },
    walkSpeed: 1.1,
    linger: [5, 12],
    shyRadius: 2.6,
  },
};
