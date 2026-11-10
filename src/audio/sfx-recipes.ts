// Sound designs, in Lanternfall's recipe format (games/lanternfall/src/audio/sfx-recipes.ts): each is
// rendered offline with the synth kit. `level` is the peak each sound is normalized to. The partial
// ratios are Lanternfall's. Plan 8: every material has its own timbre on one pentatonic scale.
import { Kit } from './synth-kit';

export type SfxBus = 'effects' | 'ambience' | 'ui';

export interface SfxDef {
  level: number;
  render: (k: Kit) => void;
  /** Number of pre-rendered takes to rotate through. */
  variants?: number;
  /** Shortest time between two plays of this sound. */
  gap?: number;
  /** Random pitch range for each play, on top of the variants. */
  jitter?: number;
  drive?: number;
  bus?: SfxBus;
}

const WOOD = [1, 2.31, 3.67];
const STONE = [1, 2.09, 3.28];
const BELL = [0.5, 1, 1.19, 1.5, 2, 2.67, 4.02];

/** D major pentatonic, from D4. Step 0 is the tonic. */
export const PENTATONIC = [0, 2, 4, 7, 9] as const;
export function pentatonicHz(step: number, rootHz = 293.66): number {
  const oct = Math.floor(step / PENTATONIC.length);
  const deg = PENTATONIC[((step % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length]!;
  return rootHz * Math.pow(2, oct + deg / 12);
}

/** Playback rate that moves a sound rendered at step 0 to `step` on the scale. */
export function pentatonicRate(step: number): number {
  return pentatonicHz(step) / pentatonicHz(0);
}

export const SFX = {
  /** The signature sound: sitting, building completion, the ritual bell (plan 8). */
  bell: { level: 0.3, gap: 0.4, variants: 2, jitter: 0.01, bus: 'effects', render: (k) => {
    const f = pentatonicHz(-5);
    k.strike(f, BELL, 4.5, 0.6, { rev: 1, rolloff: 0.7 });
    k.tone(f * 0.5, 5, 0.12, { rev: 0.8 });
  } },
  click: { level: 0.05, gap: 0.03, variants: 2, jitter: 0.02, bus: 'ui', render: (k) => {
    k.strike(k.r(820, 960), WOOD, 0.035, 0.6);
    k.noise(0.012, 0.3, { type: 'bandpass', freq: 3000, q: 1 });
  } },
  /**
   * Gathering wood: a soft marimba note, rendered at the scale's root. The game plays it at
   * `pentatonicRate(step)` so a run of swings climbs the scale (plan 3.1).
   */
  wood: { level: 0.14, gap: 0.05, variants: 3, jitter: 0, bus: 'effects', render: (k) => {
    k.strike(pentatonicHz(0), WOOD, 0.7, 0.6, { rev: 0.35 });
    k.noise(0.015, 0.12, { type: 'bandpass', freq: 1800, q: 1.5 });
  } },
  /** Gathering stone: a ceramic tap, also at the root and pitched by the game. */
  stone: { level: 0.12, gap: 0.05, variants: 3, jitter: 0, bus: 'effects', render: (k) => {
    k.strike(pentatonicHz(0), STONE, 0.35, 0.5, { rev: 0.3 });
    k.noise(0.02, 0.2, { type: 'bandpass', freq: 4200, q: 2 });
  } },
  /** A part settling into a building: a low, soft wooden knock under the melody. */
  place: { level: 0.12, gap: 0.08, variants: 3, jitter: 0.02, bus: 'effects', render: (k) => {
    k.strike(pentatonicHz(-5), WOOD, 0.45, 0.7, { rev: 0.5 });
    k.noise(0.04, 0.25, { type: 'lowpass', freq: 900, q: 0.7 });
  } },
} satisfies Record<string, SfxDef>;

export type SfxName = keyof typeof SFX;
