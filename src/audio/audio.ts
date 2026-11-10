// All audio is synthesized. Adapted from Lanternfall's AudioEngine (games/lanternfall/src/audio/audio.ts
// @ b282628): the same master compressor, generated hall reverb, pre-rendered sound bank, take
// rotation, burst softening, squared volume curve and suspend-while-hidden. The adaptive battle score,
// ducking and beam loop are gone; the buses are the plan's Master, Ambience, Effects and Music (plan 8).
import { renderTake } from './synth-kit';
import { SFX, type SfxBus, type SfxDef, type SfxName } from './sfx-recipes';

export { pentatonicHz, pentatonicRate, PENTATONIC } from './sfx-recipes';
export type { SfxName };

const DEFS = SFX as Record<SfxName, SfxDef>;
const VOICE_LIMIT = 32;
// Loudness is roughly logarithmic, so a squared curve makes sliders feel even across their range.
const curve = (slider: number) => slider * slider;

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<SfxBus | 'music', GainNode>;
  private reverbSend!: GainNode;
  private baking: Promise<void> | null = null;
  private bank = new Map<SfxName, AudioBuffer[]>();
  private lastPlayed = new Map<SfxName, number>();
  private lastTake = new Map<SfxName, number>();
  private crowd = new Map<SfxName, { count: number; at: number }>();
  private active = 0;
  masterVolume = 0.8;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    void this.prepare();
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : curve(this.masterVolume) / curve(0.8);
    this.master.connect(comp).connect(ctx.destination);
    const bus = () => { const g = ctx.createGain(); g.connect(this.master); return g; };
    this.buses = { effects: bus(), ambience: bus(), ui: bus(), music: bus() };

    // A generated hall impulse response for reverb.
    const irLen = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8) * (i < 400 ? i / 400 : 1);
      }
    }
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.45;
    const reverb = ctx.createConvolver();
    reverb.buffer = ir;
    this.reverbSend.connect(reverb).connect(this.buses.effects);
  }

  setVolume(master: number, muted: boolean) {
    this.masterVolume = master;
    this.muted = muted;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : curve(master) / curve(0.8), this.ctx.currentTime, 0.05);
  }

  /** Mutes everything while the tab is hidden. */
  suspend(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  prepare() {
    this.baking ??= this.bakeAll();
    return this.baking;
  }

  private async bakeAll() {
    if (typeof OfflineAudioContext === 'undefined') return;
    let seed = 1;
    for (const name of Object.keys(DEFS) as SfxName[]) {
      const def = DEFS[name];
      const takes: AudioBuffer[] = [];
      for (let i = 0; i < (def.variants ?? 1); i++) takes.push(await renderTake(seed++ * 7919, def.level, def.drive, def.render));
      this.bank.set(name, takes);
    }
  }

  /** `rate` shifts pitch (and length) by playback speed: gathering notes use it to walk the scale. */
  play(name: SfxName, volume = 1, rate = 1) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const takes = this.bank.get(name);
    if (!takes) return;
    const def = DEFS[name];
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name);
    if (last !== undefined && now - last < (def.gap ?? 0.02)) return;
    if (this.active >= VOICE_LIMIT) return;
    this.lastPlayed.set(name, now);

    // Rotate through the takes, never repeating the one just heard.
    let take = 0;
    if (takes.length > 1) {
      take = Math.floor(Math.random() * (takes.length - 1));
      if (take >= (this.lastTake.get(name) ?? takes.length)) take++;
      this.lastTake.set(name, take);
    }
    // A burst of one sound shouldn't add up to a wall of it, so each repeat comes in softer.
    const prev = this.crowd.get(name);
    const count = prev ? prev.count * Math.exp((prev.at - now) / 0.28) : 0;
    this.crowd.set(name, { count: count + 1, at: now });
    const gain = volume / (1 + count * 0.16);

    const src = ctx.createBufferSource();
    const buffer = takes[take]!;
    src.buffer = buffer;
    src.playbackRate.value = rate * (1 + (def.jitter ?? 0) * (Math.random() * 2 - 1));
    const dry = ctx.createGain();
    dry.gain.value = gain;
    dry.connect(this.buses[def.bus ?? 'effects']);
    let send: GainNode | null = null;
    let splitter: ChannelSplitterNode | null = null;
    if (buffer.numberOfChannels > 1) {
      // Channel 1 of a rendered take is its reverb send (synth-kit renders dry/wet as two channels).
      splitter = ctx.createChannelSplitter(2);
      send = ctx.createGain();
      send.gain.value = gain;
      src.connect(splitter);
      splitter.connect(dry, 0);
      splitter.connect(send, 1).connect(this.reverbSend);
    } else {
      src.connect(dry);
    }
    this.active++;
    src.onended = () => {
      this.active--;
      src.disconnect();
      splitter?.disconnect();
      send?.disconnect();
      dry.disconnect();
    };
    src.start();
  }
}

export const audio = new AudioEngine();
