// Gathering and carrying balance (plan 3.1, 3.2, 9.6). Every tunable number for the core loop lives here.

export type MaterialId = 'wood' | 'stone';
export const MATERIALS: readonly MaterialId[] = ['wood', 'stone'];

export const MATERIAL_INFO: Record<MaterialId, { name: string }> = {
  wood: { name: 'Wood' },
  stone: { name: 'Stone' },
};

/** The beat: one unit gathered or deposited per beat (plan 3.1, default 0.55 s). */
export const BEAT_SECONDS = 0.55;
/** Time from stepping into range to the first swing landing, so the first unit doesn't feel instant. */
export const FIRST_BEAT_SECONDS = 0.4;
/** The satchel holds this much of each material. Never upgrades (plan 3.2). */
export const SATCHEL_CAP = 20;

export type NodeKindId = 'tree' | 'boulder';

export interface NodeKindDef {
  material: MaterialId;
  /** Units a full node holds. */
  units: number;
  /** How close the caretaker must be (centre to centre, metres) to work it. */
  radius: number;
  /** Collision radius of the trunk or rock, metres. */
  solidRadius: number;
  /** Once empty, the node rests this long before regrowing… */
  restSeconds: number;
  /** …then one unit grows back every this many seconds until full. */
  regrowSecondsPerUnit: number;
  /** First pentatonic step of the run of notes a full node plays (plan 3.1). */
  noteStep: number;
}

export const NODE_KINDS: Record<NodeKindId, NodeKindDef> = {
  // 5 units, ~2.8 s of chopping; regrows in 8 + 5 x 4 = 28 s (plan: 20–40 s).
  tree: { material: 'wood', units: 5, radius: 1.75, solidRadius: 0.42, restSeconds: 8, regrowSecondsPerUnit: 4, noteStep: 0 },
  // 5 units of stone; regrows in 10 + 5 x 5 = 35 s.
  boulder: { material: 'stone', units: 5, radius: 2.05, solidRadius: 0.8, restSeconds: 10, regrowSecondsPerUnit: 5, noteStep: 2 },
};
