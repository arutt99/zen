// Synth audio with buses (Master, Ambience, Effects, Music) and a pentatonic scale (plan 8).
// Phase 0 only needs a gentle bell for the context action; Phase 1+ adds gathering tones.

export const PENTATONIC = [0, 2, 4, 7, 9] as const;

/** Frequency of a note on the major pentatonic scale, counting steps from the root. */
export function pentatonicHz(step: number, rootHz = 293.66): number {
  const oct = Math.floor(step / PENTATONIC.length);
  const deg = PENTATONIC[((step % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length]!;
  return rootHz * Math.pow(2, oct + deg / 12);
}

type Bus = 'ambience' | 'effects' | 'music';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses = new Map<Bus, GainNode>();
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    // Browsers only allow audio after a user gesture.
    const unlock = () => { this.ensure(); void this.ctx?.resume(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.8 : 0;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    for (const b of ['ambience', 'effects', 'music'] as Bus[]) {
      const g = this.ctx.createGain();
      g.connect(this.master);
      this.buses.set(b, g);
    }
    return this.ctx;
  }

  /** A soft temple-bell: a few inharmonic partials with long decays. */
  bell(step = 0): void {
    const ctx = this.ensure();
    const bus = this.buses.get('effects');
    if (!ctx || !bus || !this.enabled) return;
    const f = pentatonicHz(step, 196);
    const now = ctx.currentTime;
    for (const [mult, gain, decay] of [[1, 0.28, 3.2], [2.76, 0.12, 1.8], [5.4, 0.05, 0.9], [0.5, 0.08, 4]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      o.connect(g).connect(bus);
      o.start(now);
      o.stop(now + decay + 0.05);
    }
  }
}
