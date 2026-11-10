// Buildings as data (plan 3.3, 9.5). A building is an ordered list of parts, one part per unit of
// cost; the render kit (src/render/kits.ts) supplies a model for each part id. Phase 1 has the shelter.
import type { MaterialId } from './gathering';
import type { PlaceId } from './places';

export type BuildingId = 'shelter';

export interface PartDef {
  /** Model id in the building's render kit. */
  id: string;
  material: MaterialId;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  place: PlaceId;
  /** Render kit that draws the parts. */
  kit: string;
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
    parts: [
      { id: 'deck', material: 'wood' },
      { id: 'post_back_left', material: 'wood' },
      { id: 'post_back_right', material: 'wood' },
      { id: 'post_front_left', material: 'wood' },
      { id: 'post_front_right', material: 'wood' },
      { id: 'roof', material: 'wood' },
    ],
    restoration: 0.2,
    solidRadius: 1.55,
    siteRadius: 3.3,
  },
};

/** Units of each material the building needs in total (derived from its part list). */
export function buildingCost(b: BuildingDef): Partial<Record<MaterialId, number>> {
  const cost: Partial<Record<MaterialId, number>> = {};
  for (const p of b.parts) cost[p.material] = (cost[p.material] ?? 0) + 1;
  return cost;
}
