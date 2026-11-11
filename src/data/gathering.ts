// Gathering and carrying balance (plan 3.1, 3.2, 9.6). Every tunable number for the core loop lives here.

// Phase 4: bamboo, the bamboo grove's material (plan 4.2); it only grows in the grove.
export type MaterialId = 'wood' | 'stone' | 'bamboo';
export const MATERIALS: readonly MaterialId[] = ['wood', 'stone', 'bamboo'];

export const MATERIAL_INFO: Record<MaterialId, { name: string }> = {
  wood: { name: 'Wood' },
  stone: { name: 'Stone' },
  bamboo: { name: 'Bamboo' },
};

/** The beat: one unit gathered or deposited per beat (plan 3.1, default 0.55 s). */
export const BEAT_SECONDS = 0.55;
/** Time from stepping into range to the first swing landing, so the first unit doesn't feel instant. */
export const FIRST_BEAT_SECONDS = 0.4;
/** The satchel holds this much of each material. Never upgrades (plan 3.2). */
export const SATCHEL_CAP = 20;

export type NodeKindId = 'tree' | 'boulder' | 'bamboo';

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
  // Pacing pass (2026-11-11): 3 units (was 5), so gathering ranges over more trees; regrows in 14 + 3 x 6 = 32 s.
  tree: { material: 'wood', units: 3, radius: 1.75, solidRadius: 0.42, restSeconds: 14, regrowSecondsPerUnit: 6, noteStep: 0 },
  // 3 units of stone (was 5); regrows in 16 + 3 x 7 = 37 s.
  boulder: { material: 'stone', units: 3, radius: 2.05, solidRadius: 0.8, restSeconds: 16, regrowSecondsPerUnit: 7, noteStep: 2 },
  // Phase 4: a bamboo clump, one culm per unit (3, was 4); shoots come back quickly (bamboo grows fast): 10 + 3 x 5 = 25 s.
  bamboo: { material: 'bamboo', units: 3, radius: 1.8, solidRadius: 0.5, restSeconds: 10, regrowSecondsPerUnit: 5, noteStep: 1 },
};
