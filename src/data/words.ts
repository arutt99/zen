// Words (plan 4.4, 4.5): the opening, poem stones and notes from earlier caretakers. Words are rare and
// so valued: no tutorial text, no quest text. All of it is original. Every line here is a DRAFT for the
// owner to rewrite or approve (plan 12: "Exact poem and note text: placeholders, owner writes during
// Phase 3–4"); `draft: true` marks them, and the game shows a small PLACEHOLDER tag under drafts.
// Never use published translations of classic haiku (plan 4.4).

export type WordKind = 'poem' | 'note';

export interface WordDef {
  id: string;
  kind: WordKind;
  /** Lines shown one under another. A poem is three short lines; a note a sentence or two. */
  lines: string[];
  /** Notes are signed by an earlier caretaker (a season, never a name that implies a real person). */
  from?: string;
  /** True until the owner has approved the text. */
  draft: boolean;
}

/**
 * Chapter 1's opening (plan 4.5): someone walking, arriving, finding the place quiet and neglected.
 * Shown one line at a time over the first moments at the gate, then never again.
 */
export const OPENING: { lines: string[]; draft: boolean } = {
  lines: [
    'Far enough from everything, the path grew quiet.',
    'Beyond the old gate, a monastery sleeps under moss.',
    'A quiet place can begin with one small act.',
  ],
  draft: true,
};

export const WORDS: Record<string, WordDef> = {
  // --- Poem stones (PLACEHOLDER verse, original, for the owner to replace or approve)
  poem_gate: {
    id: 'poem_gate', kind: 'poem', draft: true,
    lines: ['The gate leans and waits,', 'its moss older than my name;', 'I step through softly.'],
  },
  poem_pond: {
    id: 'poem_pond', kind: 'poem', draft: true,
    lines: ['One leaf on the pond:', 'the whole sky turns around it', 'and comes back to rest.'],
  },
  poem_hill: {
    id: 'poem_hill', kind: 'poem', draft: true,
    lines: ['Wind along the ridge,', 'carrying nothing at all;', 'my hands learn from it.'],
  },
  poem_bamboo: {
    id: 'poem_bamboo', kind: 'poem', draft: true,
    lines: ['Bamboo past the wall,', 'knocking softly on itself:', 'a door not yet found.'],
  },
  // --- Notes from earlier caretakers (PLACEHOLDER)
  note_shelter: {
    id: 'note_shelter', kind: 'note', draft: true, from: 'a caretaker, one late spring',
    lines: ['Sweep the step before you sit on it. Then sit anyway, swept or not.'],
  },
  note_hall: {
    id: 'note_hall', kind: 'note', draft: true, from: 'a caretaker, an autumn long ago',
    lines: ['We never finished this place. We only kept beginning it, every morning.'],
  },
  note_tower: {
    id: 'note_tower', kind: 'note', draft: true, from: 'a caretaker, a winter evening',
    lines: ['Ring it once for the ones who built it, and once for whoever comes next.'],
  },
};
