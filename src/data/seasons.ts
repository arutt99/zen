// Seasons (plan 5, Phase 5): which season it is comes from the calendar (src/core/clock.ts); what a season
// looks like comes from a palette here. Art decision point A7 ("final palette per season", plan 7.4) is
// UNDECIDED: three candidate palettes live side by side so the owner can compare them in the game
// (Settings → Season palette) and in docs/phase5/README.md. Nothing else is tuned to one of them yet.
//
// A season look changes a place's preset (ground, grass, flowers, path, water, fog, grade) through
// src/core/seasonal.ts, and the shared shader values (deciduous leaf colors, evergreen tint, snow on tops,
// ground cover speckles) through src/render/materials.ts `applySeason`. Spring is the authored look
// (Phases 0–4 were built as a spring day), so spring changes the least.
// Colors are 0xRRGGBB numbers.

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_IDS: readonly SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];

export type PaletteId = 'classic' | 'gentle' | 'bold';
export const PALETTE_IDS: readonly PaletteId[] = ['classic', 'gentle', 'bold'];
/**
 * The palette the game opens with until the owner decides A7 (plan 7.4). This is the agent's
 * recommendation, not a decision; the owner can switch in Settings.
 */
export const DEFAULT_PALETTE: PaletteId = 'classic';

export interface SeasonLook {
  /** Ground patch colors (A, B, C) and how far the place's own ground moves toward them (0..1). */
  ground: [number, number, number];
  groundMix: number;
  /** Ink-look ground tint (Lanternfall+ multiplies the ground by it); snow needs a neutral one. */
  inkTint?: [number, number, number];
  /** Grass blade colors (dark, light), how far toward them, and a density multiplier. */
  grass: [number, number];
  grassMix: number;
  grassDensity: number;
  /** Flower head colors and a count multiplier (0 = none). */
  flowers: number[];
  flowerDensity: number;
  /** The packed-earth path: a color to move toward (snow, leaf litter) and how far. */
  path: number;
  pathMix: number;
  /** Water (shallow, deep) and how far toward it (winter: icy). */
  water: [number, number];
  waterMix: number;
  /** Fog tint and how far toward it (keeps the time of day's own fog mostly). */
  fog: number;
  fogMix: number;
  /** The far peaks' cap color, and how much lower the snow line comes (metres). */
  peak: number;
  peakDrop: number;
  /** Deciduous crowns (oak, birch, cherry, maple, willow, bush, gather trees): three colors per tree, and how far. */
  leaves: [number, number, number];
  leafMix: number;
  /** Evergreen crowns (pine, bamboo, moss): one tint and how far. */
  evergreen: number;
  evergreenMix: number;
  /** Snow on everything that faces up (roofs, rocks, crowns, lanterns), 0..1. */
  snow: number;
  /** Ground cover speckles (petals, fallen leaves, snow drifts): two colors and how much. */
  cover: [number, number];
  coverAmount: number;
  /** Falling things in the air: petals, leaves or snow (0 = none). */
  fall: { color: number; amount: number; size: number; speed: number };
  /** Colors of leaves and petals that drift from the crowns (Lanternfall+ life); empty keeps each tree's own. */
  drift: number[];
  /** Butterflies by day, 0..1. */
  butterflies: number;
  /** Color grade on top of the time of day: saturation multiplier and a gain tint. */
  sat: number;
  gain: [number, number, number];
}

export interface PaletteDef {
  name: string;
  /** One line for Settings and the A7 write-up. */
  note: string;
  seasons: Record<SeasonId, SeasonLook>;
}

const NONE: SeasonLook['fall'] = { color: 0xffffff, amount: 0, size: 1, speed: 0 };

/** Spring as authored (Phases 0–4): cherry pink, fresh greens, pastel flowers, petals in the air. */
const springBase: SeasonLook = {
  ground: [0x67924a, 0x8aac5c, 0xb5bd73], groundMix: 0,
  grass: [0x557f38, 0xaac65a], grassMix: 0, grassDensity: 1,
  flowers: [0xfff2c2, 0xf4b6c6, 0xffffff, 0xc8a6e0], flowerDensity: 1.15,
  path: 0xd9c39d, pathMix: 0,
  water: [0x9cc7b8, 0x3f7f7a], waterMix: 0,
  fog: 0xf2dcb8, fogMix: 0,
  peak: 0xe9eadf, peakDrop: 0,
  leaves: [0x6fa048, 0x7fb050, 0x8abf5a], leafMix: 0,
  evergreen: 0x3f6e48, evergreenMix: 0,
  snow: 0,
  cover: [0xf6c4d0, 0xfde6ec], coverAmount: 0.3,
  fall: { color: 0xf8c8d4, amount: 0.75, size: 2.6, speed: 0.35 },
  drift: [0xf6b8c8, 0xfde0e8],
  butterflies: 1,
  sat: 1, gain: [1, 1, 1],
};

export const PALETTES: Record<PaletteId, PaletteDef> = {
  // A: four seasons as most people picture a Japanese garden: sakura, deep summer green, red and gold
  // maples, and a real snowfall. Strong difference between seasons; the agent's recommendation.
  classic: {
    name: 'Classic',
    note: 'Sakura, deep summer green, red and gold maples, real snow.',
    seasons: {
      spring: springBase,
      summer: {
        ...springBase,
        ground: [0x4f8a3a, 0x6fa048, 0x98b85a], groundMix: 0.4,
        grass: [0x3f7a2c, 0x8fbf48], grassMix: 0.5, grassDensity: 1.15,
        flowers: [0x8fa8e8, 0xb090e0, 0xfff2c2, 0xffffff], flowerDensity: 1,
        water: [0x8cc4ac, 0x2f7068], waterMix: 0.35,
        leaves: [0x3f7d34, 0x4f8c3a, 0x5e9a40], leafMix: 0.85,
        evergreen: 0x2f5e3a, evergreenMix: 0.15,
        cover: [0xffffff, 0xffffff], coverAmount: 0,
        fall: NONE, drift: [0x5e9a40, 0x7fb050],
        sat: 1.06, gain: [1.0, 1.01, 0.98],
      },
      autumn: {
        ...springBase,
        ground: [0x8a8040, 0xa8904a, 0xc8a458], groundMix: 0.68,
        grass: [0x8a7a32, 0xcaa046], grassMix: 0.78, grassDensity: 0.9,
        flowers: [0xf2c84a, 0xf2e2c8, 0xc0587a], flowerDensity: 0.45,
        path: 0xc4a070, pathMix: 0.2,
        water: [0x9cb8a8, 0x3a6a70], waterMix: 0.25,
        fog: 0xf0c8a0, fogMix: 0.2,
        leaves: [0xd8402a, 0xe8782a, 0xe8b23a], leafMix: 0.88,
        evergreen: 0x3a5e3e, evergreenMix: 0.12,
        cover: [0xd85a2a, 0xe8a83a], coverAmount: 0.55,
        fall: { color: 0xe07a30, amount: 0.7, size: 3.2, speed: 0.45 },
        drift: [0xd8402a, 0xe8782a, 0xe8b23a],
        butterflies: 0.3,
        sat: 1.06, gain: [1.03, 1.0, 0.95],
      },
      winter: {
        ...springBase,
        ground: [0xdfe6ee, 0xeef2f6, 0xffffff], groundMix: 0.86,
        inkTint: [0.97, 0.99, 1.04],
        grass: [0x9aa28c, 0xd8dccc], grassMix: 0.8, grassDensity: 0.35,
        flowers: [0xd8344a], flowerDensity: 0.12,
        path: 0xe2e4e8, pathMix: 0.55,
        water: [0xb8d4dc, 0x5a8090], waterMix: 0.55,
        fog: 0xdde4ee, fogMix: 0.35,
        peak: 0xffffff, peakDrop: 7,
        leaves: [0x8a7a6a, 0x9a8a78, 0x7a6e62], leafMix: 0.8,
        evergreen: 0x2a4e40, evergreenMix: 0.3,
        snow: 0.9,
        cover: [0xffffff, 0xe8eef6], coverAmount: 0.25,
        fall: { color: 0xffffff, amount: 0.9, size: 2.4, speed: 0.6 },
        drift: [],
        butterflies: 0,
        sat: 0.9, gain: [0.98, 1.0, 1.04],
      },
    },
  },
  // B: gentler and closer to green all year: pastel spring, warm summer, amber and gold autumn (few reds),
  // a frosty winter where the grass still shows through.
  gentle: {
    name: 'Gentle',
    note: 'Softer change: amber autumn, a light frost in winter; green all year.',
    seasons: {
      spring: { ...springBase, coverAmount: 0.18, fall: { ...springBase.fall, amount: 0.4 } },
      summer: {
        ...springBase,
        ground: [0x5f8f44, 0x80a858, 0xaabb6c], groundMix: 0.2,
        grass: [0x4c7c34, 0xa0c256], grassMix: 0.25, grassDensity: 1.05,
        flowers: [0xfff2c2, 0xc8b0e8, 0xffffff], flowerDensity: 0.9,
        leaves: [0x5e9440, 0x6aa048, 0x76aa50], leafMix: 0.7,
        cover: [0xffffff, 0xffffff], coverAmount: 0,
        fall: NONE, drift: [0x76aa50],
        sat: 1.02, gain: [1.01, 1.0, 0.98],
      },
      autumn: {
        ...springBase,
        ground: [0x86904c, 0x9fa458, 0xbcb070], groundMix: 0.42,
        grass: [0x7a8a40, 0xbcb058], grassMix: 0.55, grassDensity: 0.95,
        flowers: [0xf2d070, 0xf2e2c8], flowerDensity: 0.5,
        path: 0xc8aa78, pathMix: 0.1,
        fog: 0xf0d0a8, fogMix: 0.12,
        leaves: [0xd8a040, 0xc88a3a, 0xbca850], leafMix: 0.65,
        evergreenMix: 0.05,
        cover: [0xd8a040, 0xc89a50], coverAmount: 0.3,
        fall: { color: 0xd8a040, amount: 0.4, size: 3.0, speed: 0.4 },
        drift: [0xd8a040, 0xc88a3a],
        butterflies: 0.5,
        sat: 1.0, gain: [1.02, 1.0, 0.96],
      },
      winter: {
        ...springBase,
        ground: [0xb8c4bc, 0xd0d8d2, 0xe8ecea], groundMix: 0.5,
        inkTint: [0.95, 0.99, 0.98],
        grass: [0x7a8a70, 0xb8c0a8], grassMix: 0.55, grassDensity: 0.6,
        flowers: [0xd8344a], flowerDensity: 0.15,
        path: 0xcfcfcc, pathMix: 0.3,
        water: [0xa8c8cc, 0x4a7880], waterMix: 0.3,
        fog: 0xdfe4ea, fogMix: 0.25,
        peak: 0xffffff, peakDrop: 4,
        leaves: [0x7e8268, 0x8a8a70, 0x76765e], leafMix: 0.55,
        evergreen: 0x34584a, evergreenMix: 0.2,
        snow: 0.45,
        cover: [0xf2f6f8, 0xdfe6ea], coverAmount: 0.3,
        fall: { color: 0xffffff, amount: 0.4, size: 2.0, speed: 0.5 },
        drift: [],
        butterflies: 0,
        sat: 0.92, gain: [0.99, 1.0, 1.02],
      },
    },
  },
  // C: like a woodblock print: saturated and graphic, pink everywhere in spring, vivid vermilion autumn,
  // deep snow with cool indigo light in winter.
  bold: {
    name: 'Bold',
    note: 'Woodblock-print color: pink spring, vermilion autumn, deep blue-white winter.',
    seasons: {
      spring: {
        ...springBase,
        flowers: [0xf490b0, 0xffffff, 0xffe070, 0xb890e8], flowerDensity: 1.4,
        leaves: [0xf29ab4, 0xf6b8c8, 0x9ccb64], leafMix: 0.35,
        cover: [0xf490b0, 0xfcd0dc], coverAmount: 0.5,
        fall: { color: 0xf6a8bc, amount: 1, size: 2.8, speed: 0.35 },
        drift: [0xf490b0, 0xfcd0dc],
        sat: 1.1, gain: [1.02, 1.0, 1.0],
      },
      summer: {
        ...springBase,
        ground: [0x3f8a34, 0x5aa040, 0x86c050], groundMix: 0.5,
        grass: [0x2f7a24, 0x86c840], grassMix: 0.6, grassDensity: 1.25,
        flowers: [0x5a7ae8, 0xa060e0, 0xffe070, 0xffffff], flowerDensity: 1.1,
        water: [0x7ccab0, 0x1f6a64], waterMix: 0.45,
        leaves: [0x2f7a2c, 0x3f8a30, 0x4f9a38], leafMix: 0.92,
        evergreen: 0x1f5232, evergreenMix: 0.25,
        cover: [0xffffff, 0xffffff], coverAmount: 0,
        fall: NONE, drift: [0x4f9a38],
        sat: 1.16, gain: [0.99, 1.02, 0.98],
      },
      autumn: {
        ...springBase,
        ground: [0x9a6a3a, 0xb07a40, 0xc89a50], groundMix: 0.7,
        grass: [0xa06a30, 0xd09a40], grassMix: 0.85, grassDensity: 0.85,
        flowers: [0xf2c030, 0xe05a2a], flowerDensity: 0.4,
        path: 0xb88a58, pathMix: 0.25,
        water: [0x8cb0a8, 0x2a5a68], waterMix: 0.3,
        fog: 0xf0b890, fogMix: 0.25,
        leaves: [0xe0301e, 0xf0602a, 0xc8202a], leafMix: 0.95,
        evergreen: 0x2e5236, evergreenMix: 0.2,
        cover: [0xe0401e, 0xf08a2a], coverAmount: 0.75,
        fall: { color: 0xe8502a, amount: 0.9, size: 3.4, speed: 0.45 },
        drift: [0xe0301e, 0xf0602a, 0xc8202a],
        butterflies: 0.2,
        sat: 1.15, gain: [1.04, 0.99, 0.94],
      },
      winter: {
        ...springBase,
        ground: [0xe2eaf6, 0xf2f6fc, 0xffffff], groundMix: 0.93,
        inkTint: [0.96, 0.99, 1.08],
        grass: [0xb8c4d0, 0xe8eef4], grassMix: 0.9, grassDensity: 0.2,
        flowers: [0xe0203a], flowerDensity: 0.1,
        path: 0xe8ecf2, pathMix: 0.7,
        water: [0xc8e0ec, 0x4a7098], waterMix: 0.65,
        fog: 0xc8d4ec, fogMix: 0.45,
        peak: 0xffffff, peakDrop: 9,
        leaves: [0x4a3e38, 0x5a4a40, 0x3e3430], leafMix: 0.85,
        evergreen: 0x1c3a3a, evergreenMix: 0.45,
        snow: 1,
        cover: [0xffffff, 0xdce6f6], coverAmount: 0.3,
        fall: { color: 0xffffff, amount: 1, size: 2.8, speed: 0.65 },
        drift: [],
        butterflies: 0,
        sat: 0.95, gain: [0.95, 0.99, 1.1],
      },
    },
  },
};

/** The look for a season in a palette (unknown ids fall back to the default palette). */
export function seasonLook(palette: string, season: SeasonId): SeasonLook {
  const p = PALETTES[palette as PaletteId] ?? PALETTES[DEFAULT_PALETTE];
  return p.seasons[season];
}

/** Small glyphs for the book and Settings: a blossom, a sun, a leaf, a snowflake. */
export const SEASON_GLYPH: Record<SeasonId, string> = { spring: '✿', summer: '☀', autumn: '❦', winter: '❄' };
export const SEASON_NAME: Record<SeasonId, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
