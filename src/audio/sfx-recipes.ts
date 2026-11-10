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
  // --- Phase 3
  /** The bell tower, rung by hand: a deep temple bell with a long, slow tail. */
  temple_bell: { level: 0.34, gap: 1.2, variants: 2, jitter: 0.008, bus: 'effects', render: (k) => {
    const f = pentatonicHz(-10);
    k.strike(f, [0.5, 1, 1.19, 1.5, 2, 2.42, 2.97, 4.1], 9, 0.7, { rev: 1.2, rolloff: 0.74 });
    k.tone(f * 0.5, 9.5, 0.16, { rev: 1 });
    k.tone(f * 1.003, 8, 0.08, { rev: 0.8, vib: 6, vibRate: 1.6 });
    k.noise(0.05, 0.12, { type: 'lowpass', freq: 600, q: 0.7 });
  } },
  /** The rake drawn through gravel: a soft, granular hush. */
  rake: { level: 0.1, gap: 0.5, variants: 3, jitter: 0.05, bus: 'effects', render: (k) => {
    k.noise(0.9, 0.5, { color: 'pink', type: 'bandpass', freq: 2600, to: 1800, q: 0.8, attack: 0.25, rev: 0.2 });
    k.crackle(40, 0.05, 1.0, 0.25, { freq: 4200, rev: 0.1 });
  } },
  /** A lantern catching: a breath of flame and a warm, low note. */
  lantern: { level: 0.09, gap: 0.15, variants: 3, jitter: 0.03, bus: 'effects', render: (k) => {
    k.noise(0.35, 0.4, { color: 'brown', type: 'lowpass', freq: 900, to: 300, attack: 0.04 });
    k.tone(pentatonicHz(2), 1.4, 0.18, { type: 'sine', rev: 0.8, attack: 0.08 });
  } },
  /** Words found: a paper rustle and two soft high notes. */
  page: { level: 0.08, gap: 0.4, variants: 2, jitter: 0.02, bus: 'effects', render: (k) => {
    k.noise(0.18, 0.35, { color: 'pink', type: 'highpass', freq: 2200, attack: 0.02 });
    k.strike(pentatonicHz(7), [1, 2.76], 1.6, 0.25, { at: 0.12, rev: 0.9 });
    k.strike(pentatonicHz(9), [1, 2.76], 1.8, 0.2, { at: 0.42, rev: 0.9 });
  } },
  /** The next build site reveals itself: three rising soft chimes. */
  reveal: { level: 0.1, gap: 1, variants: 1, bus: 'effects', render: (k) => {
    [4, 7, 9].forEach((st, i) => k.strike(pentatonicHz(st), [1, 2.76, 5.4], 2.4, 0.3, { at: i * 0.32, rev: 1, rolloff: 0.4 }));
  } },
} satisfies Record<string, SfxDef>;

/**
 * Ambience layers (plan 8): rendered once as seamless loops, then faded in and out by the time of day.
 * Birds and the stream by day; crickets and wind at night. `length` is the loop plus its crossfade.
 */
export const AMBIENCE = {
  birds: { level: 0.05, seconds: 23, render: (k: Kit, length: number) => {
    // Sparse calls from two or three kinds of small bird, never the same pattern twice in a loop.
    let t = 0.4;
    while (t < length - 1.5) {
      const kind = Math.floor(k.r(0, 3));
      const f = [2900, 3600, 2300][kind]!;
      const notes = kind === 0 ? Math.floor(k.r(2, 5)) : kind === 1 ? 1 : Math.floor(k.r(3, 6));
      for (let i = 0; i < notes; i++) {
        const at = t + i * (kind === 2 ? 0.09 : 0.16);
        const fr = f * k.r(0.92, 1.1);
        k.tone(fr, kind === 1 ? 0.35 : 0.08, k.r(0.25, 0.5), { type: 'sine', to: fr * (kind === 1 ? 0.7 : k.r(1.05, 1.3)), at, attack: 0.008, rev: 0.6 });
      }
      t += k.r(1.2, 4.5);
    }
  } },
  stream: { level: 0.035, seconds: 17, render: (k: Kit, length: number) => {
    k.noise(length, 0.5, { color: 'pink', type: 'bandpass', freq: 900, q: 0.5, attack: 0.5, hold: 0.95 });
    k.noise(length, 0.3, { color: 'white', type: 'bandpass', freq: 3200, q: 0.9, attack: 0.5, hold: 0.95 });
    for (let t = 0.2; t < length - 0.3; t += k.r(0.05, 0.3)) k.tone(k.r(600, 1400), 0.06, k.r(0.02, 0.06), { type: 'sine', to: k.r(1400, 2400), at: t });
  } },
  crickets: { level: 0.035, seconds: 19, render: (k: Kit, length: number) => {
    // Two crickets, each chirping in its own rhythm.
    for (const [f, period, pan] of [[4300, 0.62, 1], [4900, 0.81, 0.7]] as const) {
      for (let t = k.r(0, 0.3); t < length - 0.2; t += period * k.r(0.95, 1.05)) {
        for (let i = 0; i < 3; i++) k.tone(f, 0.025, 0.25 * pan, { type: 'triangle', at: t + i * 0.045, attack: 0.002 });
      }
    }
  } },
  wind: { level: 0.04, seconds: 21, render: (k: Kit, length: number) => {
    // Soft gusts that come and go.
    for (let t = 0; t < length - 1; t += k.r(3, 6)) k.noise(k.r(3, 5), k.r(0.3, 0.6), { color: 'brown', type: 'bandpass', freq: k.r(300, 500), to: k.r(500, 900), q: 0.6, at: t, attack: 1.5 });
  } },
} satisfies Record<string, { level: number; seconds: number; render: (k: Kit, length: number) => void }>;

export type AmbienceName = keyof typeof AMBIENCE;

export type SfxName = keyof typeof SFX;
