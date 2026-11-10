// Animal friends (plan 4.3) as data. They arrive because of what you build, wander, graze and rest.
// No needs, no feeding. Presence is derived from the place's restoration (sim/progress.ts).
import type { CircleArea, PlaceId } from './places';

export type AnimalId = 'deer' | 'crane';

export interface AnimalDef {
  id: AnimalId;
  name: string;
  place: PlaceId;
  /** Arrives once the place's restoration reaches this (the deer: the gravel garden, plan 4.2 and 9.6). */
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
    minRestoration: 0.45,
    home: { x: -9, z: -2, r: 8.5 },
    enterFrom: { x: -21, z: 8 },
    walkSpeed: 1.1,
    linger: [5, 12],
    shyRadius: 2.6,
  },
  // Phase 4 (plan 4.2, 4.3): the wind shrine brings the crane to the grove's spring pool. It wades the
  // shallows and stands a long while on one leg ('rest').
  crane: {
    id: 'crane',
    name: 'Crane',
    place: 'bamboo_grove',
    minRestoration: 1,
    home: { x: -9, z: -5.5, r: 6 },
    enterFrom: { x: -16, z: -15 },
    walkSpeed: 0.8,
    linger: [6, 14],
    shyRadius: 2.4,
  },
};
