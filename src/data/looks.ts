// Look presets (plan 7.4): everything that defines the art style, as named data the owner switches
// between in Settings. Art decision point A6 (shading family) is chosen from these at the Phase 2 gate.
//
// - painted:     the target, the painted storybook reference (docs/art-reference.jpg), built with the
//                plan 7.1 retuning checklist applied.
// - lanternfall: Lanternfall's inked look exactly as copied in Phase 0 (for comparison).
// - woodblock:   the wildcard (owner pick, 2026-11-10): a Japanese woodblock print, flat colour,
//                fine dark-brown lines, a limited palette on textured paper.
//
// Changing look reloads the page (shaders are compiled for one look). Colors are linear-ish RGB
// triples (0..1) unless the field says 0xRRGGBB.

export type LookId = 'painted' | 'lanternfall' | 'woodblock';
export const LOOK_IDS: readonly LookId[] = ['painted', 'lanternfall', 'woodblock'];
export type RGB = [number, number, number];

/** Which kinds of object get an ink outline. */
export type OutlineClass = 'figure' | 'building' | 'nature';

export interface LookDef {
  id: LookId;
  name: string;
  note: string;
  shading: {
    /** Brightness of the shadow, middle and lit tone. */
    levels: [number, number, number];
    /** Where the shadow→middle and middle→lit steps sit, in normalized light. */
    steps: [number, number];
    /** Half-width of each step: ~0.03 is a hard cel edge, 0.15+ is a soft painted blend. */
    softness: number;
    /** Color multiplied into the unlit side. Cool for Lanternfall, warm and light for Painted. */
    shadowTint: RGB;
    /** How much of the light's own hue survives (keeps dusk orange, night blue). */
    lightHue: number;
  };
  /** Strength of the brush-stroke texture in model and ground colors. */
  brush: number;
  /** Rim light strength. */
  rim: number;
  /** A global remap of every painted color: saturation, then a lift toward a warm paper tone. */
  albedo: { sat: number; lift: number; toward: RGB };
  outline: {
    on: OutlineClass[];
    /** Base line color; `albedoMix` blends in the object's own color so lines are never flat black. */
    color: RGB;
    albedoMix: number;
    /** Line width as a fraction of the screen height. */
    width: number;
  };
  ground: {
    /** Width of the edges between the broad painted patches (0.015 = crisp, 0.08 = soft). */
    patchSoftness: number;
    /** Dark line along the path edge, 0 = none. */
    pathInk: number;
    /** Soft edge of the path, metres. */
    pathSoftness: number;
    /** Grass blade budget multiplier (painted wants softer, sparser blades), and a brightness for them. */
    grass: number;
    grassLight: number;
  };
  /** Distance haze: fog density multiplier, and how far the fog color moves toward the warm paper tone. */
  haze: { density: number; paper: number };
  post: {
    bloom: { strength: number; radius: number; threshold: number };
    /** Multiplies the place preset's saturation. */
    sat: number;
    /** Added to the place preset's lift / multiplied into its gain: a warm or cool grade. */
    lift: RGB;
    gain: RGB;
    vignette: number;
    /** Paper grain overlay strength (0 = none). */
    grain: number;
    /** Posterize: number of color levels (0 = off) and how strongly it applies. */
    posterize: number;
    posterizeMix: number;
  };
  /** Ambient particle multiplier (pollen, petals, fireflies). */
  ambient: number;
}

export const LOOKS: Record<LookId, LookDef> = {
  painted: {
    id: 'painted',
    name: 'Painted (the reference)',
    note: 'Soft gouache: wide blended tones, warm light shadows, thin brown lines on figures and buildings only, paper grain and haze.',
    shading: { levels: [0.74, 0.93, 1.08], steps: [0.6, 1.04], softness: 0.17, shadowTint: [1.0, 0.92, 0.88], lightHue: 0.45 },
    brush: 0.95,
    rim: 0.55,
    albedo: { sat: 0.78, lift: 0.14, toward: [0.95, 0.88, 0.74] },
    outline: { on: ['figure', 'building'], color: [0.3, 0.2, 0.13], albedoMix: 0.3, width: 1.25 / 720 },
    ground: { patchSoftness: 0.07, pathInk: 0, pathSoftness: 0.35, grass: 0.35, grassLight: 1.5 },
    haze: { density: 1.35, paper: 0.5 },
    post: {
      bloom: { strength: 0.2, radius: 0.6, threshold: 1.15 },
      sat: 0.86,
      lift: [0.025, 0.018, 0.008],
      gain: [1.02, 1.0, 0.95],
      vignette: 0.22,
      grain: 0.05,
      posterize: 0,
      posterizeMix: 0,
    },
    ambient: 1,
  },
  lanternfall: {
    id: 'lanternfall',
    name: 'Lanternfall-like',
    note: "Lanternfall's inked look as copied in Phase 0: hard three-tone cel bands, dark outlines on everything.",
    shading: { levels: [0.6, 0.9, 1.22], steps: [0.65, 1.05], softness: 0.03, shadowTint: [0.8, 0.82, 1.08], lightHue: 0.55 },
    brush: 0.42,
    rim: 0.4,
    albedo: { sat: 1, lift: 0, toward: [1, 1, 1] },
    outline: { on: ['figure', 'building', 'nature'], color: [0.035, 0.022, 0.04], albedoMix: 0.45 * 0.1, width: 1.9 / 720 },
    ground: { patchSoftness: 0.0075, pathInk: 0.8, pathSoftness: 0.03, grass: 1, grassLight: 1 },
    haze: { density: 1, paper: 0 },
    post: {
      bloom: { strength: 0.24, radius: 0.5, threshold: 1.2 },
      sat: 1,
      lift: [0, 0, 0],
      gain: [1, 1, 1],
      vignette: 0.32,
      grain: 0,
      posterize: 0,
      posterizeMix: 0,
    },
    ambient: 1,
  },
  woodblock: {
    id: 'woodblock',
    name: 'Woodblock print (wildcard)',
    note: 'Flat colour in two tones, fine dark-brown lines on everything, a limited palette pressed onto textured paper.',
    shading: { levels: [0.8, 1.0, 1.0], steps: [0.66, 9], softness: 0.012, shadowTint: [0.86, 0.88, 0.98], lightHue: 0.3 },
    brush: 0.25,
    rim: 0,
    albedo: { sat: 0.7, lift: 0.1, toward: [0.93, 0.87, 0.74] },
    outline: { on: ['figure', 'building', 'nature'], color: [0.15, 0.1, 0.07], albedoMix: 0.15, width: 1.35 / 720 },
    ground: { patchSoftness: 0.004, pathInk: 0.6, pathSoftness: 0.02, grass: 0.35, grassLight: 1.3 },
    haze: { density: 1.2, paper: 0.8 },
    post: {
      bloom: { strength: 0.05, radius: 0.4, threshold: 1.5 },
      sat: 0.88,
      lift: [0.03, 0.025, 0.012],
      gain: [1.0, 0.98, 0.92],
      vignette: 0.12,
      grain: 0.11,
      posterize: 7,
      posterizeMix: 0.55,
    },
    ambient: 0.6,
  },
};

export const DEFAULT_LOOK: LookId = 'painted';

export function lookById(id: string | null | undefined): LookDef {
  return (LOOK_IDS as readonly string[]).includes(id ?? '') ? LOOKS[id as LookId] : LOOKS[DEFAULT_LOOK];
}
