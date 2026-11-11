// Buildings as data (plan 3.3, 9.5). A building is an ordered list of parts, one part per unit of
// cost; the render kit (src/render/kits.ts) supplies a model for each part id. Phase 3: the four
// home-valley buildings of plan 9.6. Phase 4: the bamboo grove's wind shrine, and the tea house at home
// (it needs bamboo, and its site reveals itself once the shrine is restored: plan 4.1, 4.2).
//
// Mixed materials (settled in Phase 3): deposits are counted per material, so wood and stone parts can
// arrive in any mix. To keep every mix looking whole, a part only ever rests on the ground or on an
// earlier part of its OWN material (`on`); the data check enforces it. Stone builds bases, paving, steps
// and lanterns; wood builds frames that stand on their own sills and stilts.
import type { MaterialId } from './gathering';
import type { PlaceId } from './places';

export type BuildingId = 'shelter' | 'gravel_garden' | 'meditation_hall' | 'bell_tower' | 'wind_shrine' | 'tea_house';
/**
 * Build order (plan 9.6), across places: each site opens when the buildings it `requires` are done,
 * wherever they stand (the tea house at home waits for the grove's wind shrine).
 */
export const BUILDING_IDS: readonly BuildingId[] = ['shelter', 'gravel_garden', 'meditation_hall', 'bell_tower', 'wind_shrine', 'tea_house'];

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
  /**
   * Pacing pass (2026-11-11, owner: "way too quick"): how many units the part takes. The part's model is
   * cut into this many pieces, bottom-up (src/render/kits.ts), and each unit delivered lands one piece, so
   * every unit still shows (plan 3.3: one visible piece per unit). Default 1.
   */
  pieces?: number;
}

/** One unit of cost: one piece of an authored part. `parts` on a building is a list of these. */
export interface UnitPart extends PartDef {
  /** Which piece of the part this is (0-based), and how many it has. Piece k > 0 rests on piece k - 1. */
  piece: number;
  pieces: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  place: PlaceId;
  /** Render kit that draws the parts. */
  kit: string;
  /** Buildings that must be complete before this site reveals itself (plan 3.3). */
  requires: BuildingId[];
  /**
   * Build order, one entry per unit (each authored part expanded into its pieces). The cost is derived
   * from it: one unit of the part's material per entry.
   */
  parts: UnitPart[];
  /** The parts as authored (one per model), before they are cut into pieces. */
  authored: PartDef[];
  /** How much this building adds to its place's restoration level (0..1) once complete. */
  restoration: number;
  /** Collision radius of the finished footprint, metres. */
  solidRadius: number;
  /** How close the caretaker must be to deposit (centre to centre, metres). */
  siteRadius: number;
}

type AuthoredBuilding = Omit<BuildingDef, 'parts' | 'authored'> & { parts: PartDef[] };

const AUTHORED: Record<BuildingId, AuthoredBuilding> = {
  // Plan 9.6: 6 wood, ~30 s of gathering. Response: mist lifts from the clearing.
  shelter: {
    id: 'shelter',
    name: "Caretaker's Shelter",
    place: 'home_valley',
    kit: 'shelter_kit',
    requires: [],
    parts: [
      { id: 'deck', material: 'wood', pieces: 5 },
      { id: 'post_back_left', material: 'wood', on: 'deck', pieces: 3 },
      { id: 'post_back_right', material: 'wood', on: 'deck', pieces: 3 },
      { id: 'post_front_left', material: 'wood', on: 'deck', pieces: 2 },
      { id: 'post_front_right', material: 'wood', on: 'deck', pieces: 2 },
      { id: 'roof', material: 'wood', on: 'post_front_right', pieces: 5 },
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
      { id: 'gravel_bed', material: 'stone', pieces: 6 },
      { id: 'border_left', material: 'wood', pieces: 3 },
      { id: 'border_right', material: 'wood', pieces: 3 },
      { id: 'rock_tall', material: 'stone', on: 'gravel_bed', pieces: 2 },
      { id: 'edging_front', material: 'stone', pieces: 6 },
      { id: 'edging_back', material: 'stone', pieces: 6 },
      { id: 'rock_low', material: 'stone', on: 'gravel_bed', pieces: 2 },
      { id: 'bench', material: 'wood', pieces: 2 },
      { id: 'rock_flat', material: 'stone', on: 'gravel_bed', pieces: 2 },
      { id: 'rake', material: 'wood', on: 'border_right', pieces: 4 },
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
      { id: 'plinth_back', material: 'stone', pieces: 6 },
      { id: 'plinth_left', material: 'stone', pieces: 4 },
      { id: 'plinth_right', material: 'stone', pieces: 4 },
      { id: 'plinth_front', material: 'stone', pieces: 6 },
      { id: 'floor_back', material: 'wood', pieces: 6 },
      { id: 'floor_front', material: 'wood', pieces: 6 },
      { id: 'step_lower', material: 'stone' },
      { id: 'step_upper', material: 'stone', on: 'step_lower' },
      { id: 'post_back_left', material: 'wood', on: 'floor_back' },
      { id: 'post_back_right', material: 'wood', on: 'floor_back' },
      { id: 'post_mid_left', material: 'wood', on: 'floor_back' },
      { id: 'post_mid_right', material: 'wood', on: 'floor_back' },
      { id: 'post_front_left', material: 'wood', on: 'floor_front' },
      { id: 'post_front_right', material: 'wood', on: 'floor_front' },
      { id: 'wall_back', material: 'wood', on: 'post_back_right', pieces: 7 },
      { id: 'wall_left', material: 'wood', on: 'post_front_left', pieces: 6 },
      { id: 'wall_right', material: 'wood', on: 'post_front_right', pieces: 6 },
      { id: 'roof_back', material: 'wood', on: 'post_front_right', pieces: 8 },
      { id: 'roof_front', material: 'wood', on: 'post_front_right', pieces: 8 },
      { id: 'ridge', material: 'wood', on: 'roof_front', pieces: 3 },
      { id: 'path_near', material: 'stone', pieces: 2 },
      { id: 'path_far', material: 'stone', pieces: 2 },
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
      { id: 'paving_back', material: 'stone', pieces: 4 },
      { id: 'paving_left', material: 'stone', pieces: 3 },
      { id: 'paving_right', material: 'stone', pieces: 3 },
      { id: 'paving_front', material: 'stone', pieces: 4 },
      { id: 'sill', material: 'wood', pieces: 6 },
      { id: 'post_back_left', material: 'wood', on: 'sill' },
      { id: 'post_back_right', material: 'wood', on: 'sill' },
      { id: 'post_front_left', material: 'wood', on: 'sill' },
      { id: 'post_front_right', material: 'wood', on: 'sill' },
      { id: 'braces', material: 'wood', on: 'post_front_right', pieces: 4 },
      { id: 'beam_bell', material: 'wood', on: 'braces', pieces: 4 },
      { id: 'striker', material: 'wood', on: 'beam_bell' },
      { id: 'roof_back', material: 'wood', on: 'beam_bell', pieces: 7 },
      { id: 'roof_front', material: 'wood', on: 'beam_bell', pieces: 8 },
      { id: 'step_a', material: 'stone' },
      { id: 'step_b', material: 'stone' },
      { id: 'basin', material: 'stone', pieces: 2 },
      { id: 'lantern', material: 'stone' },
    ],
    restoration: 0.25,
    solidRadius: 1.6,
    siteRadius: 3.2,
  },
  // Phase 4 (plan 4.2): the bamboo grove's small shrine, 4 stone and 8 bamboo, both found in the grove. A
  // low stone platform with a basin; four bamboo posts planted beside it, a split-bamboo roof and wind
  // chimes under the eave. Restoring it heals the grove (it is the grove's only building) and brings the
  // crane; at home, the tea house's site reveals itself and the travel map gains the shrine.
  wind_shrine: {
    id: 'wind_shrine',
    name: 'Wind Shrine',
    place: 'bamboo_grove',
    kit: 'shrine_kit',
    requires: [],
    parts: [
      { id: 'platform_back', material: 'stone', pieces: 2 },
      { id: 'post_back_left', material: 'bamboo', pieces: 3 },
      { id: 'post_back_right', material: 'bamboo', pieces: 5 },
      { id: 'platform_front', material: 'stone', pieces: 2 },
      { id: 'post_front_left', material: 'bamboo', pieces: 5 },
      { id: 'post_front_right', material: 'bamboo', pieces: 6 },
      { id: 'step', material: 'stone' },
      { id: 'roof_back', material: 'bamboo', on: 'post_front_right', pieces: 8 },
      { id: 'roof_front', material: 'bamboo', on: 'post_front_right', pieces: 8 },
      { id: 'basin', material: 'stone', on: 'platform_front', pieces: 2 },
      { id: 'ridge', material: 'bamboo', on: 'roof_front', pieces: 3 },
      { id: 'chimes', material: 'bamboo', on: 'roof_front' },
    ],
    restoration: 1,
    solidRadius: 1.5,
    siteRadius: 3.2,
  },
  // Plan 9.6: the tea house, 6 wood and 8 bamboo (bamboo comes from the grove). Response: the tea ritual,
  // and home feels lived in (the water pipe tocks, the tea set steams). It adds nothing to restoration (the
  // valley is already whole); its own touches come and go with `requires` in the place's growth list.
  tea_house: {
    id: 'tea_house',
    name: 'Tea House',
    place: 'home_valley',
    kit: 'teahouse_kit',
    requires: ['wind_shrine'],
    parts: [
      { id: 'deck', material: 'wood', pieces: 6 },
      { id: 'wall_back', material: 'bamboo', pieces: 4 },
      { id: 'post_back_left', material: 'wood', on: 'deck' },
      { id: 'post_back_right', material: 'wood', on: 'deck', pieces: 2 },
      { id: 'wall_left', material: 'bamboo', pieces: 3 },
      { id: 'wall_right', material: 'bamboo', pieces: 3 },
      { id: 'post_front_left', material: 'wood', on: 'deck', pieces: 2 },
      { id: 'post_front_right', material: 'wood', on: 'deck', pieces: 2 },
      { id: 'fence_left', material: 'bamboo', pieces: 3 },
      { id: 'roof', material: 'wood', on: 'post_front_right', pieces: 7 },
      { id: 'fence_right', material: 'bamboo', pieces: 2 },
      { id: 'water_pipe', material: 'bamboo', pieces: 2 },
      { id: 'bench', material: 'bamboo', pieces: 2 },
      { id: 'tea_set', material: 'bamboo', on: 'bench' },
    ],
    restoration: 0,
    solidRadius: 1.9,
    siteRadius: 3.4,
  },
};

/** Expands each authored part into its pieces; piece k > 0 rests on the piece before it. */
function expand(parts: PartDef[]): UnitPart[] {
  const out: UnitPart[] = [];
  for (const p of parts) {
    const n = Math.max(1, Math.round(p.pieces ?? 1));
    for (let k = 0; k < n; k++) out.push({ ...p, on: k === 0 ? p.on : p.id, piece: k, pieces: n });
  }
  return out;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = Object.fromEntries(
  Object.entries(AUTHORED).map(([k, b]) => [k, { ...b, parts: expand(b.parts), authored: b.parts }]),
) as Record<BuildingId, BuildingDef>;

/**
 * Save v6: before the pacing pass every part took one unit. Turns an old count of `material` delivered to
 * `building` into the new count that shows the same parts whole.
 */
export function unitsForOldParts(b: BuildingDef, material: MaterialId, oldCount: number): number {
  let seen = 0, units = 0;
  for (const p of b.authored) {
    if (p.material !== material) continue;
    if (seen++ >= oldCount) break;
    units += Math.max(1, Math.round(p.pieces ?? 1));
  }
  return units;
}

/** Units of each material the building needs in total (derived from its part list). */
export function buildingCost(b: BuildingDef): Partial<Record<MaterialId, number>> {
  const cost: Partial<Record<MaterialId, number>> = {};
  for (const p of b.parts) cost[p.material] = (cost[p.material] ?? 0) + 1;
  return cost;
}
