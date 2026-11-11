// Seasonal findables (plan 5, Phase 5): a few small things per place that are only there in one season —
// a cherry sprig in spring, a cicada shell in summer. Walk up and Look; the first look adds it to the
// collection book (a saved fact, like a poem). A nice extra, never needed for anything (plan 5: "collections
// stay fair"); Settings → Season → choose makes every one reachable. Collected finds are gone from the world.
import type { PlaceId } from './places';
import type { SeasonId } from './seasons';

export interface FindDef {
  id: string;
  place: PlaceId;
  season: SeasonId;
  /** Decor kind for its model (src/render/decor-models.ts), also its picture in the book. */
  kind: string;
  x: number;
  z: number;
  rot?: number;
}

export const FINDS: Record<string, FindDef> = {
  find_blossom: { id: 'find_blossom', place: 'home_valley', season: 'spring', kind: 'find_blossom', x: -15.2, z: -3.6, rot: 0.6 },
  find_shell: { id: 'find_shell', place: 'home_valley', season: 'summer', kind: 'find_shell', x: -3.0, z: 10.4, rot: 1.2 },
  find_leaf: { id: 'find_leaf', place: 'home_valley', season: 'autumn', kind: 'find_leaf', x: 17.6, z: 7.4, rot: 2.1 },
  find_camellia: { id: 'find_camellia', place: 'home_valley', season: 'winter', kind: 'find_camellia', x: 4.4, z: -13.4, rot: 0.3 },
  find_shoot: { id: 'find_shoot', place: 'bamboo_grove', season: 'spring', kind: 'find_shoot', x: 7.6, z: 11.0, rot: 0.4 },
  find_feather: { id: 'find_feather', place: 'bamboo_grove', season: 'summer', kind: 'find_feather', x: -11.0, z: -9.8, rot: 2.4 },
  find_chestnut: { id: 'find_chestnut', place: 'bamboo_grove', season: 'autumn', kind: 'find_chestnut', x: -7.0, z: -12.0, rot: 1.0 },
  find_pinecone: { id: 'find_pinecone', place: 'bamboo_grove', season: 'winter', kind: 'find_pinecone', x: 8.2, z: -1.0, rot: 3.0 },
};

export const FIND_IDS = Object.keys(FINDS);

/** The finds at a place that are out in a season and not yet collected. */
export function findsOut(place: string, season: SeasonId, collected: ReadonlySet<string>): FindDef[] {
  return Object.values(FINDS).filter((f) => f.place === place && f.season === season && !collected.has(f.id));
}
