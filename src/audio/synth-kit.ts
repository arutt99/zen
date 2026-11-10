// Copied from Lanternfall (games/lanternfall/src/audio/synth-kit.ts @ b282628). Unchanged.
// The instrument used to build sound effects. Every sound is rendered ahead of time in an offline
// audio context, so it can use many layers and still cost one voice when it plays in a busy battle.

export const SFX_RATE = 44100;

export type NoiseColor = 'white' | 'pink' | 'brown';

const NOISE_SECONDS = 3;
let noiseBuffers: Record<NoiseColor, AudioBuffer> | null = null;

function makeNoise(): Record<NoiseColor, AudioBuffer> {
  const len = NOISE_SECONDS * SFX_RATE;
  const make = () => new AudioBuffer({ length: len, sampleRate: SFX_RATE, numberOfChannels: 1 });
  const white = make();
  const pink = make();
  const brown = make();
  const w = white.getChannelData(0);
  const p = pink.getChannelData(0);
  const b = brown.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    // A light three-pole approximation of pink noise.
    b0 = 0.99765 * b0 + x * 0.099046;
    b1 = 0.963 * b1 + x * 0.2965164;
    b2 = 0.57 * b2 + x * 1.0526913;
    p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2;
    last = (last + 0.02 * x) / 1.02;
    b[i] = last * 3.5;
  }
  return { white, pink, brown };
}

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ToneOpts {
  type?: OscillatorType;
  /** Pitch at the end of the sound. */
  to?: number;
  at?: number;
  attack?: number;
  /** Reverb send, relative to the layer's level. */
  rev?: number;
  lp?: number;
  lpTo?: number;
  hp?: number;
  detune?: number;
  /** Vibrato depth in cents and its speed in Hz. */
  vib?: number;
  vibRate?: number;
  /** Hold at full level for this fraction of the length before decaying. */
  hold?: number;
}

export interface NoiseOpts {
  color?: NoiseColor;
  type?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  at?: number;
  attack?: number;
  rev?: number;
  hold?: number;
}

/** Runs each recipe twice from the same seed: once to measure its length, then to render it. */
export class Kit {
  /** The time the last layer finishes. */
  end = 0;
  usedWet = false;
  constructor(private ctx: OfflineAudioContext | null, private rng: () => number, private dry: AudioNode | null, private wet: AudioNode | null) {}

  /** A random number from this variant's own repeatable sequence. */
  r(a: number, b: number) {
    return a + (b - a) * this.rng();
  }

  private mark(t: number) {
    if (t > this.end) this.end = t;
  }

  private envelope(c: BaseAudioContext, t: number, atk: number, dur: number, vol: number, hold = 0) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.00001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    if (hold > 0) g.gain.setValueAtTime(vol, t + atk + dur * hold);
    g.gain.exponentialRampToValueAtTime(Math.max(0.000001, vol * 0.001), t + atk + dur);
    return g;
  }

  private out(c: BaseAudioContext, node: AudioNode, rev?: number) {
    node.connect(this.dry!);
    if (rev) {
      const s = c.createGain();
      s.gain.value = rev;
      node.connect(s).connect(this.wet!);
      this.usedWet = true;
    }
  }

  /** One oscillator with an optional pitch glide, filters, and vibrato. */
  tone(freq: number, dur: number, vol: number, o: ToneOpts = {}) {
    const at = o.at ?? 0;
    const atk = o.attack ?? 0.003;
    this.mark(at + atk + dur + 0.01);
    const c = this.ctx;
    if (!c) return;
    const osc = c.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), at + atk + dur);
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      const lfo = c.createOscillator();
      lfo.frequency.value = o.vibRate ?? 5.5;
      const depth = c.createGain();
      depth.gain.value = o.vib;
      lfo.connect(depth).connect(osc.detune);
      lfo.start(at);
      lfo.stop(at + atk + dur);
    }
    let node: AudioNode = osc;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.lp, at);
      if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, at + atk + dur);
      node.connect(f);
      node = f;
    }
    if (o.hp) {
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = o.hp;
      node.connect(f);
      node = f;
    }
    const g = this.envelope(c, at, atk, dur, vol, o.hold);
    node.connect(g);
    this.out(c, g, o.rev);
    osc.start(at);
    osc.stop(at + atk + dur + 0.01);
  }

  /** Filtered noise: air, dust, fire, and the body of every impact. */
  noise(dur: number, vol: number, o: NoiseOpts = {}) {
    const at = o.at ?? 0;
    const atk = o.attack ?? 0.002;
    this.mark(at + atk + dur + 0.01);
    const offset = this.r(0, NOISE_SECONDS - 0.1);
    const c = this.ctx;
    if (!c) return;
    noiseBuffers ??= makeNoise();
    const src = c.createBufferSource();
    src.buffer = noiseBuffers[o.color ?? 'white'];
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.freq ?? 1000, at);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), at + atk + dur);
    f.Q.value = o.q ?? 0.7;
    const g = this.envelope(c, at, atk, dur, vol, o.hold);
    src.connect(f).connect(g);
    this.out(c, g, o.rev);
    src.start(at, offset);
    src.stop(at + atk + dur + 0.01);
  }

  /** Two-operator FM, for metallic and magical tones. The brightness dies away with the note. */
  fm(freq: number, ratio: number, index: number, dur: number, vol: number, o: ToneOpts = {}) {
    const at = o.at ?? 0;
    const atk = o.attack ?? 0.002;
    this.mark(at + atk + dur + 0.01);
    const c = this.ctx;
    if (!c) return;
    const car = c.createOscillator();
    car.frequency.setValueAtTime(freq, at);
    if (o.to) car.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), at + atk + dur);
    const mod = c.createOscillator();
    mod.frequency.setValueAtTime(freq * ratio, at);
    if (o.to) mod.frequency.exponentialRampToValueAtTime(Math.max(20, o.to * ratio), at + atk + dur);
    const depth = c.createGain();
    depth.gain.setValueAtTime(freq * index, at);
    depth.gain.exponentialRampToValueAtTime(Math.max(1, freq * index * 0.05), at + atk + dur);
    mod.connect(depth).connect(car.frequency);
    const g = this.envelope(c, at, atk, dur, vol, o.hold);
    car.connect(g);
    this.out(c, g, o.rev);
    car.start(at);
    mod.start(at);
    car.stop(at + atk + dur + 0.01);
    mod.stop(at + atk + dur + 0.01);
  }

  /** Struck-object synthesis: partials that aren't in tune, with the high ones dying first. */
  strike(freq: number, ratios: number[], dur: number, vol: number, o: { at?: number; rev?: number; rolloff?: number } = {}) {
    const rolloff = o.rolloff ?? 0.7;
    ratios.forEach((ratio, i) => {
      const amp = Math.pow(rolloff, i);
      this.tone(freq * ratio * this.r(0.995, 1.005), dur / (1 + i * 0.45), vol * amp, { at: o.at, rev: o.rev, attack: 0.001 });
    });
  }

  /** A sawtooth through vocal formants: throats, growls, and wails. */
  voice(freq: number, to: number, dur: number, vol: number, formants: number[], o: { at?: number; attack?: number; rev?: number; vib?: number; vibRate?: number; hold?: number } = {}) {
    const at = o.at ?? 0;
    const atk = o.attack ?? 0.012;
    this.mark(at + atk + dur + 0.01);
    const c = this.ctx;
    if (!c) return;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + atk + dur);
    if (o.vib) {
      const lfo = c.createOscillator();
      lfo.frequency.value = o.vibRate ?? 18;
      const depth = c.createGain();
      depth.gain.value = o.vib;
      lfo.connect(depth).connect(osc.detune);
      lfo.start(at);
      lfo.stop(at + atk + dur);
    }
    const g = this.envelope(c, at, atk, dur, vol, o.hold);
    formants.forEach((fr, i) => {
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = fr;
      f.Q.value = 5;
      const fg = c.createGain();
      fg.gain.value = 2.4 / (i + 1);
      osc.connect(f).connect(fg).connect(g);
    });
    this.out(c, g, o.rev);
    osc.start(at);
    osc.stop(at + atk + dur + 0.01);
  }

  /** Tiny random bright pieces: breaking glass and ice, or scattered sparks. */
  shards(count: number, low: number, high: number, spread: number, vol: number, o: { at?: number; rev?: number; len?: number } = {}) {
    const len = o.len ?? 0.09;
    for (let i = 0; i < count; i++) {
      const t = (o.at ?? 0) + this.r(0, spread);
      this.tone(this.r(low, high), this.r(len * 0.5, len * 1.5), vol * this.r(0.4, 1), { at: t, rev: o.rev, attack: 0.001 });
    }
  }

  /** Short dry noise specks, like fire crackle or falling grit. */
  crackle(count: number, from: number, to: number, vol: number, o: { freq?: number; rev?: number } = {}) {
    for (let i = 0; i < count; i++) {
      this.noise(this.r(0.006, 0.022), vol * this.r(0.4, 1), { type: 'bandpass', freq: (o.freq ?? 3400) * this.r(0.6, 1.5), q: 1.4, at: this.r(from, to), rev: o.rev });
    }
  }
}

function softClip(drive: number) {
  const n = 2048;
  const curve = new Float32Array(n);
  const top = Math.tanh(drive);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * drive) / top;
  return curve;
}

function peakOf(d: Float32Array) {
  let p = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > p) p = a;
  }
  return p;
}

/**
 * Renders one take. Channel 0 is the dry sound, and channel 1, when present, is what goes to the reverb.
 * Keeping them apart means a sharp attack can stay dry while its tail blooms into the room.
 */
export async function renderTake(seed: number, level: number, drive: number | undefined, recipe: (k: Kit) => void): Promise<AudioBuffer> {
  const measure = new Kit(null, mulberry(seed), null, null);
  recipe(measure);
  const length = Math.ceil((measure.end + 0.02) * SFX_RATE);
  const ctx = new OfflineAudioContext(2, length, SFX_RATE);
  const merger = ctx.createChannelMerger(2);
  merger.connect(ctx.destination);
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  wet.connect(merger, 0, 1);
  if (drive) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClip(drive);
    shaper.oversample = '2x';
    dry.connect(shaper).connect(merger, 0, 0);
  } else {
    dry.connect(merger, 0, 0);
  }
  const kit = new Kit(ctx, mulberry(seed), dry, wet);
  recipe(kit);
  const rendered = await ctx.startRendering();
  const d = rendered.getChannelData(0);
  const w = rendered.getChannelData(1);
  const scale = level / Math.max(0.0001, peakOf(d));
  const channels = kit.usedWet ? 2 : 1;
  const out = new AudioBuffer({ length, sampleRate: SFX_RATE, numberOfChannels: channels });
  const od = out.getChannelData(0);
  const ow = channels === 2 ? out.getChannelData(1) : null;
  const fade = Math.floor(0.004 * SFX_RATE);
  for (let i = 0; i < length; i++) {
    const tail = Math.min(1, (length - i) / fade);
    od[i] = d[i] * scale * tail;
    if (ow) ow[i] = w[i] * scale * tail;
  }
  return out;
}

/** Renders a seamless loop by crossfading the extra rendered tail back over the start. */
export async function renderLoop(seed: number, level: number, loopSeconds: number, fadeSeconds: number, recipe: (k: Kit, length: number) => void): Promise<AudioBuffer> {
  const total = loopSeconds + fadeSeconds;
  const length = Math.ceil(total * SFX_RATE);
  const ctx = new OfflineAudioContext(1, length, SFX_RATE);
  const dry = ctx.createGain();
  dry.connect(ctx.destination);
  recipe(new Kit(ctx, mulberry(seed), dry, dry), total);
  const rendered = await ctx.startRendering();
  const src = rendered.getChannelData(0);
  const loopLen = Math.floor(loopSeconds * SFX_RATE);
  const fade = Math.floor(fadeSeconds * SFX_RATE);
  const out = new AudioBuffer({ length: loopLen, sampleRate: SFX_RATE, numberOfChannels: 1 });
  const o = out.getChannelData(0);
  for (let i = 0; i < loopLen; i++) {
    if (i < fade) {
      const x = i / fade;
      o[i] = src[i] * Math.sqrt(x) + src[loopLen + i] * Math.sqrt(1 - x);
    } else o[i] = src[i];
  }
  const scale = level / Math.max(0.0001, peakOf(o));
  for (let i = 0; i < loopLen; i++) o[i] *= scale;
  return out;
}
