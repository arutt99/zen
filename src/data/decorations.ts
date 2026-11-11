// Decorating v1 (plan 3.3, 10 Phase 5): free placement of decorations on decoration-allowed ground at home.
// Decorations come from buildings and shrines, never from purchases: each one is offered once its building
// is complete (derived from the facts, sim/progress.ts decorationsOffered). Placing one costs nothing and
// removing it gives nothing back; there is no inventory to run out of, only a gentle limit per place.
import type { BuildingId } from './buildings';
import type { PlaceId } from './places';

export interface DecorationDef {
  id: string;
  /** Decor kind for the model (src/render/decor-models.ts). */
  kind: string;
  /** Offered once this building is complete. */
  from: BuildingId;
  /** Keeps this much room around it (metres) from other things when placed. */
  room: number;
  /** Collision radius for the caretaker; 0 = walk over it (flowers, flat stones). */
  solid: number;
}

export const DECORATIONS: Record<string, DecorationDef> = {
  bench: { id: 'bench', kind: 'bench', from: 'shelter', room: 0.9, solid: 0.5 },
  stepping_stone: { id: 'stepping_stone', kind: 'stepping_stone', from: 'shelter', room: 0.5, solid: 0 },
  fence_wood: { id: 'fence_wood', kind: 'fence_wood', from: 'shelter', room: 0.9, solid: 0.35 },
  mossy_stone: { id: 'mossy_stone', kind: 'mossy_stone', from: 'gravel_garden', room: 0.8, solid: 0.5 },
  flower_bed: { id: 'flower_bed', kind: 'flower_bed', from: 'gravel_garden', room: 0.7, solid: 0 },
  iris: { id: 'iris', kind: 'iris', from: 'gravel_garden', room: 0.5, solid: 0 },
  fence_rope: { id: 'fence_rope', kind: 'fence_rope', from: 'gravel_garden', room: 0.9, solid: 0 },
  stone_lantern: { id: 'stone_lantern', kind: 'stone_lantern', from: 'meditation_hall', room: 0.8, solid: 0.4 },
  path_lantern: { id: 'path_lantern', kind: 'path_lantern', from: 'meditation_hall', room: 0.6, solid: 0.2 },
  maple: { id: 'maple', kind: 'maple', from: 'bell_tower', room: 1.2, solid: 0.35 },
  cherry: { id: 'cherry', kind: 'cherry', from: 'bell_tower', room: 1.2, solid: 0.35 },
  bamboo: { id: 'bamboo', kind: 'bamboo', from: 'wind_shrine', room: 1.0, solid: 0.3 },
  fence_bamboo: { id: 'fence_bamboo', kind: 'fence_bamboo', from: 'wind_shrine', room: 0.9, solid: 0.3 },
  fern: { id: 'fern', kind: 'fern', from: 'wind_shrine', room: 0.6, solid: 0 },
};

export const DECORATION_IDS = Object.keys(DECORATIONS);

/** Where decorating is allowed (plan 10: "decoration-allowed ground at home") and how many fit. */
export const DECORATE: Partial<Record<PlaceId, { max: number }>> = {
  home_valley: { max: 40 },
};

/** Minimum clearances (metres) between a decoration and the things the caretaker must keep reaching. */
export const DECOR_CLEAR = {
  /** From the path's centre line, beyond half its width. */
  path: 0.5,
  /** Beyond a site's deposit radius. */
  site: 0.8,
  /** Beyond a gather node's working radius. */
  node: 0.3,
  /** From sit spots, words, finds, the map board and exits. */
  spot: 1.6,
  /** From the caretaker standing there. */
  caretaker: 0.7,
};
