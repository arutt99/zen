// Movement and camera feel (plan 10, Phase 1), plus the trial options for art decision points
// A2 (camera) and A3 (world scale). Nothing here is locked: the owner picks at the Phase 1 gate.

export interface WalkerTuning {
  /** Metres per second at full stick. */
  maxSpeed: number;
  /** How fast the caretaker reaches the wanted velocity while pushing, m/s². */
  accel: number;
  /** How fast they come to rest when the stick is let go, m/s². */
  decel: number;
  /** Extra braking when the stick reverses direction, as a multiple of accel. */
  turnBoost: number;
  /** Collision radius, metres. */
  radius: number;
}

export const WALKER: WalkerTuning = { maxSpeed: 4.2, accel: 20, decel: 30, turnBoost: 1.8, radius: 0.35 };

export interface CameraZoom {
  /** Metres behind (toward +z) and above the caretaker. */
  distance: number;
  height: number;
  /** Seconds of velocity the view leads by. */
  lookAhead: number;
}

export interface CameraOption {
  id: string;
  name: string;
  note: string;
  /** Near and far zoom presets (pinch / wheel switch between them). */
  zooms: [CameraZoom, CameraZoom];
  /** Vertical field of view in degrees on a wide screen. */
  fov: number;
}

/** Art decision point A2: camera angle, height and zoom range. Try them on the phone in Settings. */
export const CAMERA_OPTIONS: CameraOption[] = [
  {
    id: 'a', name: 'A · Classic (~40°)',
    note: 'Phase 0 camera. Balanced: the caretaker, nearby trees and the site fit together.',
    zooms: [{ distance: 13, height: 11, lookAhead: 0.4 }, { distance: 22, height: 19, lookAhead: 0.6 }],
    fov: 34,
  },
  {
    id: 'b', name: 'B · High (~55°)',
    note: 'Steeper and closer to top-down. Trees hide the caretaker less; reads more like a board.',
    zooms: [{ distance: 9, height: 13, lookAhead: 0.45 }, { distance: 14, height: 21, lookAhead: 0.6 }],
    fov: 34,
  },
  {
    id: 'c', name: 'C · Low and close (~28°)',
    note: 'Lower, more cinematic, like the painted reference. More sky and depth; less overview.',
    zooms: [{ distance: 12, height: 6.5, lookAhead: 0.35 }, { distance: 19, height: 11, lookAhead: 0.55 }],
    fov: 38,
  },
];

export interface ScaleOption {
  id: string;
  name: string;
  note: string;
  /** Caretaker size relative to the 1.8 m Phase 0 placeholder. */
  caretaker: number;
}

/**
 * Art decision point A3: world scale. Phase 1 only trials the caretaker's size against Lanternfall-size
 * trees (4–6 m) and the current spacing; once picked, layouts and collision are built around it.
 */
export const SCALE_OPTIONS: ScaleOption[] = [
  { id: 'm', name: 'Medium caretaker (1.8 m)', note: 'Phase 0 size. Trees are about 2.5x the caretaker.', caretaker: 1 },
  { id: 's', name: 'Small caretaker (1.4 m)', note: 'Chibi-leaning: the world feels bigger, trees about 3.3x.', caretaker: 0.78 },
  { id: 'l', name: 'Large caretaker (2.2 m)', note: 'Toy-like world: trees about 2x, everything reads at phone size.', caretaker: 1.22 },
];

/** Camera ease-out when a building completes (plan 3.3): extra distance, and how long it lasts. */
export const COMPLETION_CAMERA = { pullBack: 1.45, seconds: 3.5 };
