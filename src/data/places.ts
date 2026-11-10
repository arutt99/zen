// Place layouts as data (plan 9.2). Phase 1 has the home island with its first gather nodes and site.
// Scale: 1 unit = 1 metre. The island generator (src/sim/island.ts) is Lanternfall's World.
import type { BuildingId } from './buildings';
import type { NodeKindId } from './gathering';

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
  /** Day cycle id (src/data/presets.ts DAY_CYCLES): the place's presets for each time of day. */
  daylight: string;
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
  props: { id: string; kind: string; x: number; z: number; rot?: number; scale?: number }[];
  /** Trees and boulders the caretaker gathers from (plan 3.1). */
  nodes: { id: string; kind: NodeKindId; x: number; z: number; rot?: number }[];
  /** Fixed build sites (plan 3.3). `rot` turns the building around +y; 0 faces the camera (+z). */
  sites: { id: string; building: BuildingId; x: number; z: number; rot?: number }[];
  /**
   * Low mist over the valley floor before it is restored (plan 3.4). It lifts as restoration rises
   * from 0 to `clearAt`. `fogBoost` multiplies the preset's fog density while the mist is full.
   */
  mist: { clearAt: number; fogBoost: number; puffs: CircleArea[] };
}

export const PLACES: Record<PlaceId, PlaceDef> = {
  home_valley: {
    id: 'home_valley',
    name: 'Home Valley',
    seed: 1207,
    daylight: 'home',
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
      kinds: [['oak', 3], ['pine', 3], ['birch', 1], ['bush', 3], ['willow', 1], ['maple', 2], ['bamboo', 2]],
      count: 140,
      clustering: 0.7,
    },
    rocks: 22,
    props: [
      { id: 'bench_pond', kind: 'bench', x: -9, z: 4, rot: Math.PI },
      { id: 'cherry_pond', kind: 'cherry', x: -14, z: -5, rot: 0.6 },
      { id: 'reeds_pond_a', kind: 'reedclump', x: -12.6, z: 0.4 },
      { id: 'reeds_pond_b', kind: 'reedclump', x: -5.4, z: -4.8 },
      // Phase 2: the Zen kit, placed so the owner can judge each piece in the real game. Phase 3 lays
      // out the valley properly (the raked gravel may give way to the gravel garden site).
      { id: 'lantern_bench', kind: 'stone_lantern', x: -11.4, z: 4.8, rot: 0.3 },
      { id: 'lantern_shelter', kind: 'stone_lantern', x: 6.6, z: -0.6, rot: -0.2 },
      { id: 'step_a', kind: 'stepping_stone', x: -3.5, z: 4.5, rot: 0.2 },
      { id: 'step_b', kind: 'stepping_stone', x: -4.5, z: 4.0, rot: 1.1 },
      { id: 'step_c', kind: 'stepping_stone', x: -5.5, z: 4.5, rot: 2.3 },
      { id: 'step_d', kind: 'stepping_stone', x: -6.5, z: 4.1, rot: 0.7 },
      { id: 'step_e', kind: 'stepping_stone', x: -7.5, z: 4.6, rot: 1.9 },
      { id: 'lotus_a', kind: 'lotus', x: -9.8, z: -3.2, rot: 0.4 },
      { id: 'lotus_b', kind: 'lotus', x: -7.6, z: -1.0, rot: 2.2, scale: 0.8 },
      { id: 'lotus_c', kind: 'lotus', x: -10.6, z: 0.2, rot: 4.1, scale: 0.9 },
      { id: 'moss_stone_a', kind: 'mossy_stone', x: -13.4, z: 2.2, rot: 0.8, scale: 0.7 },
      { id: 'moss_stone_b', kind: 'mossy_stone', x: 3.6, z: 1.6, rot: 2.6, scale: 0.6 },
      { id: 'gravel_circle', kind: 'raked_gravel', x: -16, z: 10, rot: 0 },
      { id: 'fence_back_a', kind: 'fence_wood', x: 10, z: -8.3, rot: 0 },
      { id: 'fence_back_b', kind: 'fence_wood', x: 12.1, z: -8.1, rot: 0.1 },
      { id: 'rope_pond_a', kind: 'fence_rope', x: -12.4, z: -6.4, rot: 0.6 },
      { id: 'rope_pond_b', kind: 'fence_rope', x: -10.4, z: -7.3, rot: 0.25 },
      { id: 'maple_pond', kind: 'maple', x: -16.5, z: -1.5, rot: 1.4 },
      { id: 'maple_hill', kind: 'maple', x: 17, z: 9.5, rot: 0.2 },
      { id: 'bamboo_corner', kind: 'bamboo', x: -18, z: -10, rot: 0 },
    ],
    // A loose ring of trees between spawn and the shelter clearing, two boulders past it.
    nodes: [
      { id: 'tree_a', kind: 'tree', x: 6, z: 5.5, rot: 0.4 },
      { id: 'tree_b', kind: 'tree', x: 10.5, z: 6.5, rot: 2.1 },
      { id: 'tree_c', kind: 'tree', x: -4.5, z: 8.5, rot: 4.0 },
      { id: 'tree_d', kind: 'tree', x: 13.5, z: 1.5, rot: 1.2 },
      { id: 'tree_e', kind: 'tree', x: -3.5, z: 13, rot: 5.3 },
      { id: 'tree_f', kind: 'tree', x: 7, z: 12.5, rot: 3.3 },
      { id: 'boulder_a', kind: 'boulder', x: 15, z: -8, rot: 0.7 },
      { id: 'boulder_b', kind: 'boulder', x: 4.5, z: -12, rot: 2.6 },
      { id: 'boulder_c', kind: 'boulder', x: -3.5, z: -9, rot: 4.4 },
    ],
    sites: [{ id: 'shelter', building: 'shelter', x: 9.5, z: -3.5, rot: -0.35 }],
    mist: {
      clearAt: 0.2,
      fogBoost: 2.4,
      puffs: [
        { x: 9.5, z: -3.5, r: 7 },
        { x: 2, z: 4, r: 9 },
        { x: -9, z: -2, r: 8 },
        { x: 4, z: -11, r: 7 },
        { x: -10, z: 10, r: 7 },
        { x: 15, z: 8, r: 7 },
      ],
    },
  },
};
