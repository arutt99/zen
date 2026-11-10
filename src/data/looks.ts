// Look presets (plan 7.4): everything that defines the art style, as named data. Art decision point A6
// is decided (owner, 2026-11-10): Lanternfall+. The other trial looks (Painted, Painted+, Woodblock) were
// removed at the start of Phase 3; plain Lanternfall stays as the light look the browser smoke test drives
// (software GL can't run Lanternfall+ fast enough) and as a fallback.
//
// - lanternfallplus: Lanternfall's crisp bands, ink on everything, rich color and no grain or haze, with
//                baked occlusion, contact shadows and the rich detail pass. The game always opens in it.
// - lanternfall: Lanternfall's inked look exactly as copied in Phase 0, with the base models.
//
// Changing look reloads the page (shaders are compiled for one look). Colors are linear-ish RGB
// triples (0..1) unless the field says 0xRRGGBB.

export type LookId = 'lanternfall' | 'lanternfallplus';
export const LOOK_IDS: readonly LookId[] = ['lanternfallplus', 'lanternfall'];
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
  /**
   * Which model set to build: 'base' is the Phase 2 models; 'rich' (Lanternfall+, PC first) adds the
   * detail pass (smoother rocks, lumpy crowns, pond edge stones, finer lantern and kits) plus leafy inked
   * crowns and roots, inked wood grain and stone cracks, ground dressing, a livelier pond with koi,
   * butterflies, falling leaves, a swaying lantern and lantern light at night.
   */
  detail: 'base' | 'rich';
  light: {
    /** Ambient occlusion baked into model colors where parts meet each other and the ground (0 = off, 1 = full). */
    ao: number;
    /** Soft contact shadows painted onto the ground under props, trees, buildings and figures (0 = off). */
    contact: number;
    /** Blur of the sun's shadow edges (shadow map radius, in texels). */
    shadowSoftness: number;
  };
}

const NO_EXTRA_LIGHT: LookDef['light'] = { ao: 0, contact: 0, shadowSoftness: 3 };

export const LOOKS: Record<LookId, LookDef> = {
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
    detail: 'base',
    light: NO_EXTRA_LIGHT,
  },
  lanternfallplus: {
    id: 'lanternfallplus',
    name: 'Lanternfall+ (crisp, inked, grounded)',
    note: "Lanternfall's hard bands, ink lines on everything and rich color, with soft shadows where things meet, ground shadows and more detail on stones, trees, the pond edge, the lantern and the shelter.",
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
    detail: 'rich',
    light: { ao: 0.75, contact: 0.7, shadowSoftness: 4 },
  },
};

export const DEFAULT_LOOK: LookId = 'lanternfallplus';

export function lookById(id: string | null | undefined): LookDef {
  return (LOOK_IDS as readonly string[]).includes(id ?? '') ? LOOKS[id as LookId] : LOOKS[DEFAULT_LOOK];
}
