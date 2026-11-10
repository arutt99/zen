// Movement and camera feel (plan 10, Phase 1), plus the camera and caretaker size chosen at art
// decision points A2 and A3 (owner, 2026-11-10: camera A, Medium caretaker). The options that were
// trialled and not picked are described in docs/phase1/README.md.

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

/**
 * Art decision point A2, decided (owner, 2026-11-10): camera A, Classic (~40°). Models, paths and
 * build sites are sized for this view from here on. One entry; the list shape stays so saves still load.
 */
export const CAMERA_OPTIONS: CameraOption[] = [
  {
    id: 'a', name: 'A · Classic (~40°)',
    note: 'The caretaker, nearby trees and the site fit together on one phone screen.',
    zooms: [{ distance: 13, height: 11, lookAhead: 0.4 }, { distance: 22, height: 19, lookAhead: 0.6 }],
    fov: 34,
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
 * Art decision point A3, decided (owner, 2026-11-10): Medium caretaker (1.8 m) against 4–6 m trees
 * (about 2.5x). Layouts, radii, collision and the Phase 2 kit are built around it.
 */
export const SCALE_OPTIONS: ScaleOption[] = [
  { id: 'm', name: 'Medium caretaker (1.8 m)', note: 'Trees are about 2.5x the caretaker.', caretaker: 1 },
];

/** Camera ease-out when a building completes (plan 3.3): extra distance, and how long it lasts. */
export const COMPLETION_CAMERA = { pullBack: 1.45, seconds: 3.5 };
