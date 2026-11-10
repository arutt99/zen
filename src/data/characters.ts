// Character proportions (art decision point A4, due at the Phase 2 gate). Two styles to compare on
// the phone; the deer follows the caretaker's style. Both caretakers stand 1.8 m to the top of the bun
// (A3, decided), so every radius and layout stays valid whichever style is picked.
// Colors follow the reference: cream top, brown hakama-style trousers, dark hair, woven basket.

export type CharacterStyleId = 'chibi' | 'storybook';
export const CHARACTER_STYLES: readonly CharacterStyleId[] = ['chibi', 'storybook'];

export interface CaretakerProportions {
  name: string;
  note: string;
  /** Head radius (the head is a sphere slightly taller than wide). */
  head: number;
  /** Height of the hip line and of the shoulders above the ground. */
  hip: number;
  shoulder: number;
  /** Torso half-width at the shoulders and at the waist. */
  chest: number;
  waist: number;
  /** Trouser-leg radius at the hem, and arm length. */
  hem: number;
  arm: number;
  /** Bun radius. */
  bun: number;
  /** Basket size multiplier (it should read clearly at phone size either way). */
  basket: number;
  /** Eye size and spacing as a fraction of the head radius. */
  eye: number;
  eyeGap: number;
}

export const CARETAKER: Record<CharacterStyleId, CaretakerProportions> = {
  chibi: {
    name: 'Chibi (like the reference)',
    note: 'Big head, about 2.5 heads tall, short limbs; reads instantly at phone size.',
    head: 0.34, hip: 0.44, shoulder: 0.93, chest: 0.24, waist: 0.21, hem: 0.13, arm: 0.42, bun: 0.15, basket: 1.05, eye: 0.11, eyeGap: 0.36,
  },
  storybook: {
    name: 'Storybook (taller)',
    note: 'About 4 heads tall: a slimmer, older-feeling caretaker with longer limbs.',
    head: 0.2, hip: 0.74, shoulder: 1.27, chest: 0.2, waist: 0.16, hem: 0.11, arm: 0.6, bun: 0.1, basket: 0.95, eye: 0.13, eyeGap: 0.4,
  },
};

export interface DeerProportions {
  /** Shoulder height, body length and radius, head radius, leg radius, neck length. */
  shoulder: number;
  body: number;
  bodyR: number;
  head: number;
  leg: number;
  neck: number;
}

export const DEER: Record<CharacterStyleId, DeerProportions> = {
  chibi: { shoulder: 0.62, body: 0.62, bodyR: 0.26, head: 0.24, leg: 0.055, neck: 0.28 },
  storybook: { shoulder: 0.95, body: 0.95, bodyR: 0.25, head: 0.15, leg: 0.04, neck: 0.48 },
};

export const CARETAKER_HEIGHT = 1.8;

/** Top of the bun for a style: head centre + head radius + most of the bun. Tests check it is ~1.8 m. */
export function caretakerHeight(p: CaretakerProportions): number {
  const headY = p.shoulder + p.head * 0.95;
  return headY + p.head * 1.02 + p.bun * 1.4;
}
