// Buildings as data (plan 3.3, 9.5). A building is an ordered list of parts, one part per unit of
// cost; the render kit (src/render/kits.ts) supplies a model for each part id. Phase 3: the four
// home-valley buildings of plan 9.6 (the tea house waits for bamboo, Phase 4).
//
// Mixed materials (settled in Phase 3): deposits are counted per material, so wood and stone parts can
// arrive in any mix. To keep every mix looking whole, a part only ever rests on the ground or on an
// earlier part of its OWN material (`on`); the data check enforces it. Stone builds bases, paving, steps
// and lanterns; wood builds frames that stand on their own sills and stilts.
import type { MaterialId } from './gathering';
import type { PlaceId } from './places';

export type BuildingId = 'shelter' | 'gravel_garden' | 'meditation_hall' | 'bell_tower';
/** Build order in the home valley (plan 9.6); each site opens when the ones it `requires` are done. */
export const BUILDING_IDS: readonly BuildingId[] = ['shelter', 'gravel_garden', 'meditation_hall', 'bell_tower'];

/**
 * Building kit styles (art decision point A5, due at the Phase 2 gate): the part set buildings are
 * assembled from, and how a half-built building looks. Both draw the same part ids, so the cost and
 * build order don't depend on the style; src/render/kits.ts has the models.
 */
export type KitStyleId = 'temple' | 'timber';
export const KIT_STYLES: readonly KitStyleId[] = ['temple', 'timber'];
export const KIT_STYLE_INFO: Record<KitStyleId, { name: string; note: string }> = {
  temple: {
    name: 'Temple (like the reference)',
    note: 'Square cedar posts on stone footings, a raised plank floor, shoji screens, a grey tiled roof with a paper lantern and a noren curtain. Squared-timber scaffolding with a ladder.',
  },
  timber: {
    name: 'Rustic timber',
    note: 'Round log posts lashed with rope, a log floor, woven reed screens, a thick thatched roof with crossed ridge poles. Lashed-pole scaffolding.',
  },
};

export interface PartDef {
  /** Model id in the building's render kit. */
  id: string;
  material: MaterialId;
  /** The earlier part (same material) this one rests on; omitted = it stands on the ground. */
  on?: string;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  place: PlaceId;
  /** Render kit that draws the parts. */
  kit: string;
  /** Buildings that must be complete before this site reveals itself (plan 3.3). */
  requires: BuildingId[];
  /** Build order. The cost is derived from it: one unit of the part's material per part. */
  parts: PartDef[];
  /** How much this building adds to its place's restoration level (0..1) once complete. */
  restoration: number;
  /** Collision radius of the finished footprint, metres. */
  solidRadius: number;
  /** How close the caretaker must be to deposit (centre to centre, metres). */
  siteRadius: number;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  // Plan 9.6: 6 wood, ~30 s of gathering. Response: mist lifts from the clearing.
  shelter: {
    id: 'shelter',
    name: "Caretaker's Shelter",
    place: 'home_valley',
    kit: 'shelter_kit',
    requires: [],
    parts: [
      { id: 'deck', material: 'wood' },
      { id: 'post_back_left', material: 'wood', on: 'deck' },
      { id: 'post_back_right', material: 'wood', on: 'deck' },
      { id: 'post_front_left', material: 'wood', on: 'deck' },
      { id: 'post_front_right', material: 'wood', on: 'deck' },
      { id: 'roof', material: 'wood', on: 'post_front_right' },
    ],
    restoration: 0.2,
    solidRadius: 1.55,
    siteRadius: 3.3,
  },
  // Plan 9.6: 4 wood, 6 stone, ~1 min. Response: the raking ritual; the pond clears and the deer arrives.
  gravel_garden: {
    id: 'gravel_garden',
    name: 'Gravel Garden',
    place: 'home_valley',
    kit: 'garden_kit',
    requires: ['shelter'],
    parts: [
      { id: 'gravel_bed', material: 'stone' },
      { id: 'border_left', material: 'wood' },
      { id: 'border_right', material: 'wood' },
      { id: 'rock_tall', material: 'stone', on: 'gravel_bed' },
      { id: 'edging_front', material: 'stone' },
      { id: 'edging_back', material: 'stone' },
      { id: 'rock_low', material: 'stone', on: 'gravel_bed' },
      { id: 'bench', material: 'wood' },
      { id: 'rock_flat', material: 'stone', on: 'gravel_bed' },
      { id: 'rake', material: 'wood', on: 'border_right' },
    ],
    restoration: 0.25,
    solidRadius: 2.2,
    siteRadius: 3.6,
  },
  // Plan 9.6: 14 wood, 10 stone, ~2–3 min. Response: lanterns along the path; the first caretaker note.
  meditation_hall: {
    id: 'meditation_hall',
    name: 'Meditation Hall',
    place: 'home_valley',
    kit: 'hall_kit',
    requires: ['gravel_garden'],
    parts: [
      { id: 'plinth_back', material: 'stone' },
      { id: 'plinth_left', material: 'stone' },
      { id: 'plinth_right', material: 'stone' },
      { id: 'plinth_front', material: 'stone' },
      { id: 'floor_back', material: 'wood' },
      { id: 'floor_front', material: 'wood' },
      { id: 'step_lower', material: 'stone' },
      { id: 'step_upper', material: 'stone', on: 'step_lower' },
      { id: 'post_back_left', material: 'wood', on: 'floor_back' },
      { id: 'post_back_right', material: 'wood', on: 'floor_back' },
      { id: 'post_mid_left', material: 'wood', on: 'floor_back' },
      { id: 'post_mid_right', material: 'wood', on: 'floor_back' },
      { id: 'post_front_left', material: 'wood', on: 'floor_front' },
      { id: 'post_front_right', material: 'wood', on: 'floor_front' },
      { id: 'wall_back', material: 'wood', on: 'post_back_right' },
      { id: 'wall_left', material: 'wood', on: 'post_front_left' },
      { id: 'wall_right', material: 'wood', on: 'post_front_right' },
      { id: 'roof_back', material: 'wood', on: 'post_front_right' },
      { id: 'roof_front', material: 'wood', on: 'post_front_right' },
      { id: 'ridge', material: 'wood', on: 'roof_front' },
      { id: 'path_near', material: 'stone' },
      { id: 'path_far', material: 'stone' },
      { id: 'lantern_left', material: 'stone' },
      { id: 'lantern_right', material: 'stone' },
    ],
    restoration: 0.3,
    solidRadius: 2.9,
    siteRadius: 4.3,
  },
  // Plan 9.6: 10 wood, 8 stone, ~2 min. Response: the bell ritual; the trail gate to the bamboo grove opens.
  bell_tower: {
    id: 'bell_tower',
    name: 'Bell Tower',
    place: 'home_valley',
    kit: 'tower_kit',
    requires: ['meditation_hall'],
    parts: [
      { id: 'paving_back', material: 'stone' },
      { id: 'paving_left', material: 'stone' },
      { id: 'paving_right', material: 'stone' },
      { id: 'paving_front', material: 'stone' },
      { id: 'sill', material: 'wood' },
      { id: 'post_back_left', material: 'wood', on: 'sill' },
      { id: 'post_back_right', material: 'wood', on: 'sill' },
      { id: 'post_front_left', material: 'wood', on: 'sill' },
      { id: 'post_front_right', material: 'wood', on: 'sill' },
      { id: 'braces', material: 'wood', on: 'post_front_right' },
      { id: 'beam_bell', material: 'wood', on: 'braces' },
      { id: 'striker', material: 'wood', on: 'beam_bell' },
      { id: 'roof_back', material: 'wood', on: 'beam_bell' },
      { id: 'roof_front', material: 'wood', on: 'beam_bell' },
      { id: 'step_a', material: 'stone' },
      { id: 'step_b', material: 'stone' },
      { id: 'basin', material: 'stone' },
      { id: 'lantern', material: 'stone' },
    ],
    restoration: 0.25,
    solidRadius: 1.6,
    siteRadius: 3.2,
  },
};

/** Units of each material the building needs in total (derived from its part list). */
export function buildingCost(b: BuildingDef): Partial<Record<MaterialId, number>> {
  const cost: Partial<Record<MaterialId, number>> = {};
  for (const p of b.parts) cost[p.material] = (cost[p.material] ?? 0) + 1;
  return cost;
}
