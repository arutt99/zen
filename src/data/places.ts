// Place layouts as data (plan 9.2). Phase 3 lays out the whole home valley: four build sites, enough
// trees and boulders, sit spots, poem stones and caretaker notes, and the props that come and go as
// the valley heals (plan 3.4). Phase 4 adds the first journey (plan 4.1, 4.2): a trail out through the
// trail gate to the bamboo grove (a place of its own), exits and arrival points, and the travel map board.
// Scale: 1 unit = 1 metre. The island generator (src/sim/island.ts) is Lanternfall's World.
import type { BuildingId } from './buildings';
import type { NodeKindId } from './gathering';

export type PlaceId = 'home_valley' | 'bamboo_grove';
/** Every place, in the order the travel map lists them. */
export const PLACE_IDS: readonly PlaceId[] = ['home_valley', 'bamboo_grove'];

export interface CircleArea { x: number; z: number; r: number }

export interface DecorMix {
  /** Decor kind (src/render/decor-models.ts) and its relative weight. */
  kinds: [string, number][];
  /** Most items to place. */
  count: number;
  /** 0..1: how much items prefer the noise clusters (groves) over even spread. */
  clustering: number;
}

/** Where the caretaker appears when arriving at a place, and which way they face. */
export interface Arrival { x: number; z: number; face: { x: number; z: number } }

/**
 * A way out of a place (plan 4.1): walking into the circle travels to another place, arriving at one of
 * its named arrival points. `requires` keeps it shut until a building is complete; while shut, `closed`
 * circles block the way (the shut trail gate), so the trail can't be walked around.
 */
export interface ExitDef {
  id: string;
  to: PlaceId;
  /** Arrival point id at the destination. */
  arrive: string;
  x: number;
  z: number;
  r: number;
  requires?: BuildingId;
  closed?: CircleArea[];
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
  /** More packed-earth trails (Phase 4: the trail out through the trail gate). */
  trails: [number, number][][];
  /** Ways out to other places (Phase 4). */
  exits: ExitDef[];
  /**
   * Named arrival points: `trail` for walking in along a trail, `map` for travelling by the map (plan 4.1).
   * The place's `spawn` is where a brand-new game starts.
   */
  arrivals: Record<string, Arrival>;
  /**
   * The painted travel map's board (plan 4.1): at home by the trail gate, in a journey place by its shrine.
   * Its context action opens the map once a second place has been found. `at` is where the place sits on
   * the painted map (0..100 across, 0..60 down).
   */
  map: { x: number; z: number; rot: number; at: { x: number; y: number } };
  /** Shown on the first arrival only (plan 4.4: words are rare), and on the map. */
  title: string;
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
   * Sit spots (plan 3.5): where the caretaker sits and which way they face. `requires` hides one until
   * that building is complete (the shelter's response: "a sit spot appears").
   */
  sits: { id: string; x: number; z: number; face: { x: number; z: number }; /** Seat height above the ground. */ seat: number; requires?: BuildingId }[];
  /** Poem stones and notes from earlier caretakers (plan 4.4): words by id (src/data/words.ts). */
  words: { id: string; x: number; z: number; rot?: number; requires?: BuildingId }[];
  /**
   * Restoration props (plan 3.4): they grow in once the place's restoration reaches `min`, and shrink
   * away once it reaches `max` (overgrowth). Never solid, so nothing appears in the caretaker's way.
   */
  growth: { id: string; kind: string; x: number; z: number; rot?: number; scale?: number; min?: number; max?: number; /** Only once this building is complete (the tea house's touches). */ requires?: BuildingId }[];
  /**
   * Low mist over the valley floor before it is restored (plan 3.4). It lifts as restoration rises
   * from 0 to `clearAt`. `fogBoost` multiplies the preset's fog density while the mist is full.
   */
  mist: { clearAt: number; fogBoost: number; puffs: CircleArea[] };
  /** The pond starts murky (0..1) and clears as restoration rises to `clearAt` (the gravel garden). */
  water: { murk: number; clearAt: number };
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
    // From the old gate at the south end, up past the shelter's clearing to the meditation hall's steps.
    path: [[2, 18.5], [1.6, 12], [-0.8, 5.5], [0.6, -1.5], [-0.4, -6], [-2, -8.7]],
    // Phase 4: the trail out of the valley, from beside the bell tower through the trail gate into the hills.
    trails: [[[15.6, -10.6], [16.0, -13.4], [16.6, -15.4], [17.7, -17.4], [18.6, -19.6]]],
    exits: [
      {
        id: 'trail_grove', to: 'bamboo_grove', arrive: 'trail', x: 18.4, z: -19.0, r: 1.5, requires: 'bell_tower',
        // The shut trail gate can't be walked through. (The ground beside it is open valley floor, but a
        // shut exit never fires, so walking round the gate only reaches the valley's quiet back corner.)
        closed: [{ x: 16.6, z: -15.4, r: 1.3 }],
      },
    ],
    arrivals: {
      // Back from the grove: just inside the trail gate, looking down into the valley.
      trail: { x: 15.9, z: -13.2, face: { x: 12, z: -6 } },
      // By the map board.
      map: { x: 14.7, z: -14.4, face: { x: 8, z: -6 } },
    },
    map: { x: 13.6, z: -16.2, rot: 0.35, at: { x: 30, y: 38 } },
    title: 'Home Valley',
    pathWidth: 2.2,
    pond: { x: -9, z: -2, r: 4.5 },
    // Chapter 1 begins at the gate (plan 4.5, default; see docs/phase3/README.md): just inside it, facing the valley.
    spawn: { x: 2.2, z: 14.6 },
    clearings: [
      { x: 2.2, z: 14.6, r: 3.5 },
      { x: 9, z: -4, r: 5 },
      { x: -9, z: 3.5, r: 3 },
      { x: -13, z: 9, r: 4.5 },
      { x: -2, z: -12, r: 5.5 },
      { x: 13, z: -12, r: 4.5 },
    ],
    decor: {
      kinds: [['oak', 3], ['pine', 3], ['birch', 1], ['bush', 3], ['willow', 1], ['maple', 2], ['bamboo', 2]],
      count: 140,
      clustering: 0.7,
    },
    rocks: 22,
    props: [
      { id: 'gate_old', kind: 'old_gate', x: 2.1, z: 16.6, rot: 0.05 },
      // Phase 4: the travel map, painted on a board by the trail gate (plan 4.1).
      { id: 'map_board', kind: 'map_board', x: 13.6, z: -16.2, rot: 0.35 },
      { id: 'bench_pond', kind: 'bench', x: -9, z: 4, rot: Math.PI },
      { id: 'cherry_pond', kind: 'cherry', x: -14, z: -5, rot: 0.6 },
      { id: 'reeds_pond_a', kind: 'reedclump', x: -12.6, z: 0.4 },
      { id: 'reeds_pond_b', kind: 'reedclump', x: -5.4, z: -4.8 },
      { id: 'lantern_bench', kind: 'stone_lantern', x: -11.4, z: 4.8, rot: 0.3 },
      { id: 'lantern_shelter', kind: 'stone_lantern', x: 6.4, z: -0.4, rot: -0.2 },
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
      { id: 'fence_back_a', kind: 'fence_wood', x: 8.4, z: -9.6, rot: 0 },
      { id: 'fence_back_b', kind: 'fence_wood', x: 10.5, z: -9.4, rot: 0.1 },
      { id: 'rope_pond_a', kind: 'fence_rope', x: -12.4, z: -6.4, rot: 0.6 },
      { id: 'rope_pond_b', kind: 'fence_rope', x: -10.4, z: -7.3, rot: 0.25 },
      { id: 'maple_pond', kind: 'maple', x: -16.5, z: -1.5, rot: 1.4 },
      { id: 'maple_hill', kind: 'maple', x: 17, z: 9.5, rot: 0.2 },
      { id: 'bamboo_corner', kind: 'bamboo', x: -18, z: -10, rot: 0 },
      { id: 'maple_hall', kind: 'maple', x: 5.6, z: -15, rot: 2.4 },
    ],
    // Ten trees and seven boulders spread over the valley, so there is always one nearby (plan 3.1):
    // 34 wood and 24 stone build the whole valley.
    nodes: [
      { id: 'tree_a', kind: 'tree', x: 6, z: 5.5, rot: 0.4 },
      { id: 'tree_b', kind: 'tree', x: 10.5, z: 6.5, rot: 2.1 },
      { id: 'tree_c', kind: 'tree', x: -4.5, z: 8.5, rot: 4.0 },
      { id: 'tree_d', kind: 'tree', x: 14.5, z: 2.5, rot: 1.2 },
      { id: 'tree_e', kind: 'tree', x: -4.5, z: 14, rot: 5.3 },
      { id: 'tree_f', kind: 'tree', x: 7.5, z: 12.5, rot: 3.3 },
      { id: 'tree_g', kind: 'tree', x: -17.5, z: 3, rot: 0.9 },
      { id: 'tree_h', kind: 'tree', x: 19, z: -3, rot: 2.7 },
      { id: 'tree_i', kind: 'tree', x: -14, z: -11.5, rot: 1.6 },
      { id: 'tree_j', kind: 'tree', x: 19.5, z: 8, rot: 4.6 },
      { id: 'boulder_a', kind: 'boulder', x: 17, z: -5.5, rot: 0.7 },
      { id: 'boulder_b', kind: 'boulder', x: 5.5, z: -11, rot: 2.6 },
      { id: 'boulder_c', kind: 'boulder', x: -9, z: -11, rot: 4.4 },
      { id: 'boulder_d', kind: 'boulder', x: -19, z: -5, rot: 1.1 },
      { id: 'boulder_e', kind: 'boulder', x: 15.5, z: 12, rot: 3.6 },
      { id: 'boulder_f', kind: 'boulder', x: -9, z: 14.5, rot: 5.0 },
      { id: 'boulder_g', kind: 'boulder', x: 20, z: -12.5, rot: 2.0 },
    ],
    sites: [
      { id: 'shelter', building: 'shelter', x: 9.5, z: -3.5, rot: -0.35 },
      { id: 'gravel_garden', building: 'gravel_garden', x: -13, z: 9.5, rot: 0.25 },
      { id: 'meditation_hall', building: 'meditation_hall', x: -2.2, z: -12.2, rot: 0.08 },
      { id: 'bell_tower', building: 'bell_tower', x: 12.5, z: -12.5, rot: -0.3 },
      // Phase 4: beside the gravel garden on the valley's west edge, facing back into the valley.
      { id: 'tea_house', building: 'tea_house', x: -20.2, z: 11.6, rot: 0.75 },
    ],
    sits: [
      { id: 'sit_bench', x: -9, z: 4, face: { x: -9, z: -2 }, seat: 0.2 },
      // On the edge of the shelter's deck, looking out over the valley.
      { id: 'sit_shelter', x: 9.2, z: -1.6, face: { x: 4, z: 6 }, seat: 0.42, requires: 'shelter' },
      // The garden's bench, facing the raked gravel.
      { id: 'sit_garden', x: -12.4, z: 11.8, face: { x: -13.2, z: 9 }, seat: 0.22, requires: 'gravel_garden' },
      // On the hall's top step, looking down the path.
      { id: 'sit_hall', x: -2, z: -8.6, face: { x: 1, z: 4 }, seat: 0.36, requires: 'meditation_hall' },
    ],
    words: [
      { id: 'poem_pond', x: -6.2, z: 1.2, rot: 0.6 },
      { id: 'poem_gate', x: 5.2, z: 15.2, rot: -0.4 },
      { id: 'poem_hill', x: 16, z: 6, rot: -1.2 },
      { id: 'poem_bamboo', x: -16.5, z: -8, rot: 1.0 },
      { id: 'note_shelter', x: 11.8, z: -1.4, rot: -0.5, requires: 'shelter' },
      { id: 'note_hall', x: 1.4, z: -10.2, rot: 0.3, requires: 'meditation_hall' },
      { id: 'note_tower', x: 10, z: -14.2, rot: -0.2, requires: 'bell_tower' },
      { id: 'note_tea', x: -16.8, z: 7.0, rot: 0.6, requires: 'tea_house' },
    ],
    // The valley heals (plan 3.4, 9.6). Levels: shelter 0.2, + garden 0.45, + hall 0.75, + bell tower 1.
    growth: [
      // Overgrowth that recedes: brambles and tall weeds over the clearings and the path's edges.
      { id: 'bramble_a', kind: 'bramble', x: 4.6, z: -5.2, rot: 0.3, max: 0.2 },
      { id: 'bramble_b', kind: 'bramble', x: 12.6, z: -6.2, rot: 2.0, max: 0.2 },
      { id: 'weeds_a', kind: 'tall_weeds', x: 3.2, z: 7.2, rot: 1.0, max: 0.2 },
      { id: 'weeds_b', kind: 'tall_weeds', x: -2.8, z: 2.2, rot: 2.6, max: 0.2 },
      { id: 'bramble_c', kind: 'bramble', x: -9.8, z: 7.2, rot: 1.2, max: 0.45 },
      { id: 'weeds_c', kind: 'tall_weeds', x: -16.4, z: 12.6, rot: 0.4, max: 0.45 },
      { id: 'weeds_d', kind: 'tall_weeds', x: -5.8, z: -3.8, rot: 3.3, max: 0.45, scale: 0.8 },
      { id: 'bramble_d', kind: 'bramble', x: -6.8, z: -7.6, rot: 0.8, max: 0.75 },
      { id: 'bramble_e', kind: 'bramble', x: 2.6, z: -8.2, rot: 4.1, max: 0.75 },
      { id: 'weeds_e', kind: 'tall_weeds', x: -3.8, z: -6.0, rot: 1.9, max: 0.75 },
      { id: 'bramble_f', kind: 'bramble', x: 9.6, z: -9.0, rot: 2.9, max: 1 },
      { id: 'weeds_f', kind: 'tall_weeds', x: 15.6, z: -15.0, rot: 0.6, max: 1 },
      { id: 'weeds_g', kind: 'tall_weeds', x: 16.4, z: -9.2, rot: 2.2, max: 1 },
      // What spreads in: flower beds and new growth.
      { id: 'flowers_a', kind: 'flower_bed', x: 6.0, z: -1.6, rot: 0.2, min: 0.2 },
      { id: 'flowers_b', kind: 'flower_bed', x: 12.4, z: -0.4, rot: 1.4, min: 0.2 },
      { id: 'flowers_c', kind: 'flower_bed', x: -6.6, z: 6.6, rot: 2.1, min: 0.45 },
      { id: 'flowers_d', kind: 'flower_bed', x: -16.2, z: 6.4, rot: 0.9, min: 0.45 },
      { id: 'iris_a', kind: 'iris', x: -12.9, z: -4.6, rot: 0.3, min: 0.45 },
      { id: 'iris_b', kind: 'iris', x: -5.0, z: 0.4, rot: 1.7, min: 0.45 },
      { id: 'flowers_e', kind: 'flower_bed', x: 2.6, z: -5.6, rot: 0.5, min: 0.75 },
      { id: 'flowers_f', kind: 'flower_bed', x: -6.4, z: -9.6, rot: 2.4, min: 0.75 },
      { id: 'flowers_g', kind: 'flower_bed', x: 15.4, z: -8.4, rot: 1.1, min: 1 },
      { id: 'flowers_h', kind: 'flower_bed', x: 4.8, z: 9.6, rot: 2.9, min: 1 },
      { id: 'cherry_young', kind: 'cherry', x: 13.2, z: 4.8, rot: 1.9, scale: 0.75, min: 1 },
      // Lanterns along the path (the hall's response).
      { id: 'path_lantern_a', kind: 'path_lantern', x: 3.3, z: 10.4, rot: 0, min: 0.75 },
      { id: 'path_lantern_b', kind: 'path_lantern', x: -2.8, z: 6.2, rot: 0, min: 0.75 },
      { id: 'path_lantern_c', kind: 'path_lantern', x: 2.4, z: 0.4, rot: 0, min: 0.75 },
      { id: 'path_lantern_d', kind: 'path_lantern', x: -2.6, z: -3.8, rot: 0, min: 0.75 },
      // The trail gate to the bamboo grove (the bell tower's response): closed, then open.
      { id: 'trail_gate_shut', kind: 'trail_gate_shut', x: 16.6, z: -15.4, rot: -0.5, max: 1 },
      { id: 'trail_gate_open', kind: 'trail_gate_open', x: 16.6, z: -15.4, rot: -0.5, min: 1 },
      // Phase 4: the tea house makes home feel lived in: a lantern by its garden, flowers, a bamboo fence.
      { id: 'tea_lantern', kind: 'stone_lantern', x: -22.6, z: 15.4, rot: 0.4, min: 0, requires: 'tea_house' },
      { id: 'tea_flowers', kind: 'flower_bed', x: -21.6, z: 15.9, rot: 1.2, min: 0, requires: 'tea_house' },
      { id: 'tea_fence', kind: 'fence_bamboo', x: -22.4, z: 7.2, rot: 1.3, min: 0, requires: 'tea_house' },
    ],
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
    water: { murk: 0.45, clearAt: 0.45 },
  },
  // Phase 4: the first journey (plan 4.2). A long valley of tall bamboo: the trail comes in at the south end
  // and winds up past a spring pool to a clearing where the old wind shrine stands half-fallen. Bamboo clumps
  // to cut, a few mossy boulders for the shrine's stones, two poem stones, sit spots, and the crane who
  // comes once the shrine is restored. The trail is walked the first time; after that the map is quicker.
  bamboo_grove: {
    id: 'bamboo_grove',
    name: 'Bamboo Grove',
    title: 'The Bamboo Grove',
    seed: 3301,
    daylight: 'grove',
    halfW: 19,
    halfH: 21,
    margin: 16,
    relief: 0.75,
    hills: 7,
    // The trail runs on south past the way out (z 21), so the hills part for it and for the camera behind you.
    path: [[0.8, 34], [1.4, 26], [1.6, 21.2], [2.8, 15], [0.2, 9], [-2.6, 3.5], [-0.8, -2.5], [1.2, -7.2]],
    trails: [],
    pathWidth: 2.0,
    exits: [
      // Back along the trail to the valley (always open).
      { id: 'trail_home', to: 'home_valley', arrive: 'trail', x: 1.6, z: 21.0, r: 1.4 },
    ],
    arrivals: {
      trail: { x: 2.2, z: 17.0, face: { x: 1, z: 9 } },
      map: { x: 4.6, z: -6.6, face: { x: 1.5, z: -11 } },
    },
    map: { x: 5.8, z: -8.6, rot: -0.5, at: { x: 72, y: 20 } },
    pond: { x: -9, z: -5.5, r: 3.6 },
    // A brand-new game never starts here; the trail arrival is the grove's natural start.
    spawn: { x: 2.2, z: 17.0 },
    clearings: [
      { x: 2.2, z: 17.0, r: 3.5 },
      { x: 1.5, z: -10.5, r: 6.5 },
      { x: -6, z: -1.5, r: 3 },
      { x: 5.2, z: 6.2, r: 2.5 },
    ],
    decor: {
      kinds: [['bamboo', 10], ['pine', 2], ['maple', 2], ['bush', 2], ['birch', 1]],
      count: 190,
      clustering: 0.8,
    },
    rocks: 16,
    props: [
      { id: 'map_board', kind: 'map_board', x: 5.8, z: -8.6, rot: -0.5 },
      { id: 'bench_trail', kind: 'bench', x: 5.2, z: 6.6, rot: -1.3 },
      { id: 'moss_stone_a', kind: 'mossy_stone', x: -12.6, z: -2.4, rot: 0.6, scale: 0.8 },
      { id: 'moss_stone_b', kind: 'mossy_stone', x: 6.8, z: -13.8, rot: 2.2, scale: 0.7 },
      { id: 'lantern_pool', kind: 'stone_lantern', x: -5.2, z: -8.6, rot: 0.5 },
      { id: 'lotus_a', kind: 'lotus', x: -9.8, z: -6.2, rot: 0.8 },
      { id: 'lotus_b', kind: 'lotus', x: -8.0, z: -4.4, rot: 2.6, scale: 0.8 },
      { id: 'reeds_a', kind: 'reedclump', x: -12.2, z: -7.8 },
      { id: 'step_a', kind: 'stepping_stone', x: -3.4, z: -3.6, rot: 0.4 },
      { id: 'step_b', kind: 'stepping_stone', x: -4.5, z: -3.0, rot: 1.6 },
      { id: 'maple_shrine', kind: 'maple', x: -4.8, z: -14.6, rot: 0.9 },
      { id: 'fence_trail_a', kind: 'fence_bamboo', x: 4.8, z: 12.6, rot: 1.75 },
      { id: 'fence_trail_b', kind: 'fence_bamboo', x: -1.2, z: 13.2, rot: 1.35 },
    ],
    // Eight bamboo clumps along the trail and around the clearing, and three mossy boulders: the shrine
    // takes 8 bamboo and 4 stone, and the tea house at home another 8 bamboo.
    nodes: [
      { id: 'bamboo_a', kind: 'bamboo', x: 6.4, z: 15.2, rot: 0.3 },
      { id: 'bamboo_b', kind: 'bamboo', x: -3.6, z: 10.4, rot: 1.9 },
      { id: 'bamboo_c', kind: 'bamboo', x: 5.6, z: 2.0, rot: 3.1 },
      { id: 'bamboo_d', kind: 'bamboo', x: -7.4, z: 4.6, rot: 4.4 },
      { id: 'bamboo_e', kind: 'bamboo', x: 9.6, z: -5.2, rot: 2.4 },
      { id: 'bamboo_f', kind: 'bamboo', x: -1.8, z: -16.0, rot: 5.2 },
      { id: 'bamboo_g', kind: 'bamboo', x: 10.4, z: -13.4, rot: 0.8 },
      { id: 'bamboo_h', kind: 'bamboo', x: 4.2, z: -3.0, rot: 1.2 },
      { id: 'boulder_a', kind: 'boulder', x: -8.4, z: 12.4, rot: 2.1 },
      { id: 'boulder_b', kind: 'boulder', x: 11.6, z: 4.8, rot: 0.4 },
      { id: 'boulder_c', kind: 'boulder', x: -9.6, z: -13.2, rot: 3.3 },
    ],
    sites: [
      { id: 'wind_shrine', building: 'wind_shrine', x: 1.4, z: -11.6, rot: 0.05 },
    ],
    sits: [
      // The bench halfway up the trail, among the bamboo.
      { id: 'sit_trail', x: 5.2, z: 6.6, face: { x: -2, z: 5 }, seat: 0.2 },
      // A flat stone at the spring pool.
      { id: 'sit_pool', x: -6.0, z: -2.0, face: { x: -9, z: -5.5 }, seat: 0.18 },
      // The shrine's step, once it is restored.
      { id: 'sit_shrine', x: 1.6, z: -8.6, face: { x: 1, z: 2 }, seat: 0.3, requires: 'wind_shrine' },
    ],
    words: [
      { id: 'poem_grove_trail', x: -1.6, z: 16.4, rot: 0.4 },
      { id: 'poem_grove_pool', x: -12.4, z: -4.6, rot: 1.2 },
      { id: 'note_shrine', x: -2.6, z: -9.4, rot: 0.5, requires: 'wind_shrine' },
    ],
    // The grove heals all at once, with its shrine (restoration 0 → 1).
    growth: [
      // Fallen culms and tangles beside the trail and in the clearing.
      { id: 'fallen_a', kind: 'fallen_bamboo', x: 4.6, z: 10.8, rot: 0.4, max: 1 },
      { id: 'fallen_b', kind: 'fallen_bamboo', x: -3.8, z: 6.6, rot: 2.2, max: 1 },
      { id: 'fallen_c', kind: 'fallen_bamboo', x: 2.6, z: -0.2, rot: 1.1, max: 1 },
      { id: 'fallen_d', kind: 'fallen_bamboo', x: -3.2, z: -6.6, rot: 2.9, max: 1 },
      { id: 'bramble_a', kind: 'bramble', x: 5.8, z: -6.0, rot: 0.6, max: 1 },
      { id: 'bramble_b', kind: 'bramble', x: -4.4, z: -12.0, rot: 1.8, max: 1 },
      { id: 'weeds_a', kind: 'tall_weeds', x: -5.6, z: 0.6, rot: 0.2, max: 1 },
      { id: 'weeds_b', kind: 'tall_weeds', x: 6.2, z: -10.2, rot: 2.4, max: 1 },
      // What comes back: ferns under the bamboo, iris at the pool, lanterns along the trail.
      { id: 'fern_a', kind: 'fern', x: -2.2, z: 7.0, rot: 0.3, min: 1 },
      { id: 'fern_b', kind: 'fern', x: 3.8, z: -1.0, rot: 1.4, min: 1 },
      { id: 'fern_c', kind: 'fern', x: -4.8, z: -11.0, rot: 2.5, min: 1 },
      { id: 'fern_d', kind: 'fern', x: 6.6, z: 9.4, rot: 3.6, min: 1 },
      { id: 'fern_e', kind: 'fern', x: 6.4, z: -11.0, rot: 4.4, min: 1 },
      { id: 'iris_a', kind: 'iris', x: -11.8, z: -3.4, rot: 0.6, min: 1 },
      { id: 'iris_b', kind: 'iris', x: -6.4, z: -7.8, rot: 2.0, min: 1 },
      { id: 'flowers_a', kind: 'flower_bed', x: 4.6, z: -15.6, rot: 0.8, min: 1 },
      { id: 'path_lantern_a', kind: 'path_lantern', x: 4.2, z: 13.4, rot: 0, min: 1 },
      { id: 'path_lantern_b', kind: 'path_lantern', x: -1.6, z: 4.4, rot: 0, min: 1 },
      { id: 'path_lantern_c', kind: 'path_lantern', x: 2.8, z: -5.6, rot: 0, min: 1 },
    ],
    mist: {
      clearAt: 1,
      fogBoost: 2.0,
      puffs: [
        { x: 1.5, z: -10.5, r: 7 },
        { x: -1, z: 2, r: 8 },
        { x: -9, z: -5, r: 6 },
        { x: 3, z: 12, r: 7 },
      ],
    },
    water: { murk: 0.5, clearAt: 1 },
  },
};
