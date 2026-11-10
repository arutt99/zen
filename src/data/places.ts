// Place layouts as data (plan 9.2). Phase 0 has only the first home island.
// Scale: 1 unit = 1 metre. The island generator (src/sim/island.ts) is Lanternfall's World.

export type PlaceId = 'home_valley';

export interface CircleArea { x: number; z: number; r: number }

export interface DecorMix {
  /** Decor kind (src/render/decor-models.ts) and its relative weight. */
  kinds: [string, number][];
  /** Most items to place. */
  count: number;
  /** 0..1: how much items prefer the noise clusters (groves) over even spread. */
  clustering: number;
}

export interface PlaceDef {
  id: PlaceId;
  name: string;
  seed: number;
  preset: string;
  /** Half extents of the open, walkable valley floor. */
  halfW: number;
  halfH: number;
  /** Extra ground around the valley floor for hills and the island rim. */
  margin: number;
  /** Rolling ground amplitude and the height of the hills that ring the valley, in metres. */
  relief: number;
  hills: number;
  /** Control points of the packed-earth path, walked from the first to the last. */
  path: [number, number][];
  pathWidth: number;
  pond: CircleArea;
  spawn: { x: number; z: number };
  /** Kept free of scattered trees and rocks. */
  clearings: CircleArea[];
  decor: DecorMix;
  rocks: number;
  /** Hand-placed props. */
  props: { id: string; kind: string; x: number; z: number; rot?: number }[];
}

export const PLACES: Record<PlaceId, PlaceDef> = {
  home_valley: {
    id: 'home_valley',
    name: 'Home Valley',
    seed: 1207,
    preset: 'home_day',
    halfW: 24,
    halfH: 18,
    margin: 16,
    relief: 0.55,
    hills: 6,
    path: [[2, 17], [1, 10], [-2, 4], [1, -3], [6, -8], [5, -15]],
    pathWidth: 2.2,
    pond: { x: -9, z: -2, r: 4.5 },
    spawn: { x: 1.5, z: 9 },
    clearings: [
      { x: 1.5, z: 9, r: 4 },
      { x: 9, z: -4, r: 5 },
      { x: -9, z: 3.5, r: 3 },
    ],
    decor: {
      kinds: [['oak', 4], ['pine', 3], ['birch', 2], ['bush', 3], ['willow', 1]],
      count: 140,
      clustering: 0.7,
    },
    rocks: 22,
    props: [
      { id: 'bench_pond', kind: 'bench', x: -9, z: 4, rot: Math.PI },
      { id: 'cherry_pond', kind: 'cherry', x: -14, z: -5, rot: 0.6 },
      { id: 'reeds_pond_a', kind: 'reedclump', x: -12.6, z: 0.4 },
      { id: 'reeds_pond_b', kind: 'reedclump', x: -5.4, z: -4.8 },
    ],
  },
};
