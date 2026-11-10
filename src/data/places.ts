// Place layouts as data (plan 9.2). Phase 0 has only the first home island.

export type PlaceId = 'home_valley';

export interface CircleArea { x: number; z: number; r: number }

export interface PlaceDef {
  id: PlaceId;
  name: string;
  seed: number;
  preset: string;
  /** Walkable island radius in metres (1 unit = 1 m). */
  islandRadius: number;
  /** Height range of the terrain bumps, in metres. */
  terrainRelief: number;
  pond: CircleArea;
  spawn: { x: number; z: number };
  /** Trees and rocks are placed by seeded scatter inside the island, avoiding these areas. */
  clearings: CircleArea[];
  treeCount: number;
  rockCount: number;
  /** Fixed props. Kinds are resolved by render/places builders. */
  props: { id: string; kind: 'bench' | 'cherry' | 'pine' | 'rock'; x: number; z: number; rot?: number }[];
  palette: Record<'moss' | 'fern' | 'cedar' | 'lightWood' | 'paper' | 'stone' | 'waterLight' | 'waterDeep' | 'lantern' | 'cherry' | 'roof', string>;
}

export const PLACES: Record<PlaceId, PlaceDef> = {
  home_valley: {
    id: 'home_valley',
    name: 'Home Valley',
    seed: 1207,
    preset: 'day',
    islandRadius: 26,
    terrainRelief: 1.2,
    pond: { x: -6, z: -3, r: 4.5 },
    spawn: { x: 0, z: 6 },
    clearings: [
      { x: 0, z: 6, r: 4 },
      { x: 6, z: -4, r: 5 },
    ],
    treeCount: 34,
    rockCount: 18,
    props: [
      { id: 'bench_pond', kind: 'bench', x: -6, z: 2.5, rot: 0 },
      { id: 'cherry_pond', kind: 'cherry', x: -10.5, z: -6 },
    ],
    palette: {
      moss: '#779777',
      fern: '#A3B591',
      cedar: '#846B50',
      lightWood: '#D9C39D',
      paper: '#F2E4C8',
      stone: '#9D9C8B',
      waterLight: '#9CC7B8',
      waterDeep: '#5E968E',
      lantern: '#F4C98A',
      cherry: '#E9A9B8',
      roof: '#5F6B6A',
    },
  },
};
