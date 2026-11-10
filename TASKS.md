# Tasks

**Current phase: 1, The feel. Waiting at the gate.** (plan section 10)

The Phase 0 owner gate check (below) was still open when the owner asked for Phase 1 to be built; please do both checks together.

## Phase 0: Fork the engine
- [x] TypeScript project at the repo root: build to one HTML file, serve, test, typecheck, manifest
- [x] Copy and trim Lanternfall's engine (plan 9.1), from `arutt99/eGiAdMfElS` at `b282628`. See "Engine status" below.
- [x] Renderer, quality tiers (Low/Medium/High/Ultra, default picked by device and GPU), post chain (paint filter, bloom, grade, tilt-shift), context-loss handling, frame smoothing and automatic resolution
- [x] Painterly materials: brush texture, three-tone cel bands, rim light, wind, ink outline shells (Lanternfall's inked look; the classic look is still in `style.ts`)
- [x] First home island on Lanternfall's island generator: terrain, pond with lily pads and reeds, packed-earth path, groves, rocks, grass and flowers, a cherry tree and a bench; sky, clouds, floating islets, light rays, drifting pollen; one daytime preset
- [x] Placeholder caretaker (capsule + head + basket) and damped follow camera with two zoom presets
- [x] Input: one move vector (keyboard, gamepad, touch joystick) + one context action (sit on the bench), via the proximity rule
- [x] Versioned save (position + settings), corrupt-save fallback, autosave on hide
- [x] Synth audio on Lanternfall's synth kit and engine: compressor, reverb, buses, pre-rendered bell, click, wood and stone tones
- [x] GitHub Actions: typecheck, test, build on every push
- [x] `AGENTS.md`, `README.md`, `TASKS.md`, `docs/ART_PIPELINE.md`, `docs/CHANGELOG.md`
- [x] Unit tests (25) and a Playwright smoke test at phone and laptop sizes
- [x] **Owner:** art decision point **A1: 2D vs 3D** decided: **3D** (2026-11-10).
- [ ] **Owner:** gate check on a real phone browser and on PC (see below)

### Gate checklist (owner)
- [ ] `dist/index.html` opens on PC
- [ ] …and in a phone browser (iPhone Safari and/or Android Chrome), landscape
- [ ] The island renders with the painterly pipeline
- [ ] Holds frame rate on Medium on the phone (fps shows bottom-left)
- [ ] The caretaker walks around with the joystick
- [ ] CI is green

### Engine status
Copied from Lanternfall (`games/lanternfall/src` at commit `b282628`); each file's first line says where it came from and what changed.

| Lanternfall | Here | Notes |
|---|---|---|
| `render/engine.ts` | `src/render/engine.ts` | quality table moved to `src/data/quality.ts`; RTS camera rig removed |
| `render/materials.ts`, `render/mb.ts`, `render/style.ts` | same paths | unchanged (style storage key renamed) |
| `render/decor-models.ts` | same path | meadow-type kinds kept; cherry and bench added |
| `render/stage.ts`, `render/biomes.ts` | `src/render/stage.ts`, `src/data/presets.ts` | lantern, rifts, build overlay removed; biome → place preset |
| `sim/world.ts` | `src/sim/island.ts` | path + terrain + rim kept; build rules removed; pond and decor from place data |
| `render/vfx.ts` | same path | particles and rings only |
| `audio/synth-kit.ts`, `audio/audio.ts` | same paths | kit unchanged; engine trimmed to buses and sound bank (no battle score) |
| `core/util.ts`, `core/util-render.ts`, `core/pacing.ts`, `ui/touch.ts` | same paths | unchanged (`damp`, `hashString` added to util) |
| `core/save.ts` | not copied | Lanternfall's save is battle-specific; `src/core/save.ts` keeps its write-on-hide habit and adds versions, migrations and field repair |
| `scripts/*.mjs` | `scripts/` | same approach (esbuild → one inlined HTML file, node:test runner); output goes to `dist/` |
| `render/hero-models.ts` | not yet | Phase 2, for the real caretaker and animals |

Known Phase 0 gaps: trees between the camera and the caretaker can hide them (Phase 1 camera work, A2); performance has only been measured with software rendering, not on a real phone.

## Phase 1: The feel
See plan section 10. Owner direction (2026-11-10): **nothing jumps from 0 to 100%** (plan pillar 6).

- [x] Movement: 8-way on keys, analog on stick and touch; acceleration, a crisp stop and a harder brake when reversing; sliding collisions with trunks, rocks, boulders, the pond and the finished shelter. Tuning in `src/data/feel.ts`
- [x] Damped follow camera with two zoom presets per camera option, and a short ease-out when a building completes
- [x] Headless core loop `src/sim/loop.ts`: the beat clock (0.55 s), gathering, depositing and node regrowth, all through the proximity rule (site > node > context)
- [x] Facts in `src/sim/state.ts` (satchel, deposits; the only place they change; emits events), derived progress in `src/sim/progress.ts` (parts built, remaining cost, restoration, mist)
- [x] Automatic chopping and chipping with a tool swing timed to the beat; one pentatonic note per unit, climbing through the node's units
- [x] Trees deplete visibly with every unit: a canopy puff goes, a notch is cut, the crown shrinks, leaves fall and chips fly; the last unit leaves a stump. Boulders lose a chunk per unit and shrink. Emptied nodes rest, then regrow one unit at a time (28–35 s). A half-gathered node stays half-gathered
- [x] Satchel cap 20 per material; the basket on the caretaker's back fills and empties item by item (one stick per wood, one pebble per stone); a HUD chip shows what you carry and hides when empty
- [x] One build site (the shelter, 6 wood): ground marker, ghost outline, cost shown above it when you stand on it; one part per unit (deck, four posts, roof), each arcs from the basket and settles in with dust and a note; scaffolding while incomplete
- [x] Completion: the bell, a petal and dust burst, a camera ease-out, and the first restoration response: the valley's mist lifts and the fog thins
- [x] Save v2 (v1 migrates): position, satchel, deposits and the trial settings. Every deposit is written at once; gathering within a second; and on hide. Loading repairs out-of-range facts
- [x] Opening line on the first visit (plan 4.4)
- [x] Unit tests (41): gather awards, leaving stops at once, regrowth, satchel cap, deposits never exceed cost, part order, derived progress and mist, fact repair, save round trip and v1 migration, corrupt save, reachability, kit parts, node views deplete and regrow
- [x] Pacing bot (`src/sim/pacing-bot.ts`) runs in the tests: a perfect bot builds the shelter in 9.8 s of play (one cycle). See gaps
- [x] Browser smoke test: gather and deposit in the real build, then reload and check the facts came back exactly
- [x] **Art decision points A2 and A3:** three camera options and three caretaker sizes to try in Settings. Write-up with screenshots and a recommendation: [`docs/phase1/README.md`](docs/phase1/README.md)
- [ ] **Owner:** pick A2 (camera) and A3 (scale) after trying them on the phone
- [ ] **Owner:** gate check (below)

### Gate checklist (owner)
- [ ] On a phone, someone new to the game gathers and builds the shelter without being told how
- [ ] …and keeps gathering afterwards
- [ ] Closing the tab mid-deposit and reopening keeps exactly what was delivered
- [ ] Holds frame rate on Medium on the phone with the new effects (mist, particles)

### Known Phase 1 gaps
- Only the first site exists, so after the shelter there is nothing to build with what you gather (Phase 3 adds the rest). The pacing bot's 9.8 s is a perfect player on a short first loop: below the plan's ~30 s for the shelter and 30–90 s cycle target. Real players walk less directly; the target is checked properly once Phase 3 adds the longer buildings.
- Gather trees look like decor trees (only the boulders got a moss cap to tell them apart). A gentle highlight or a distinct gatherable tree kind would help new players; Phase 2's Zen kit is the place for it.
- In mixed-material buildings, parts of one material can appear before the parts of another that sit under them (deposits are per material). Only matters from the gravel garden on; to settle with A5 (the building kit) in Phase 2.
- Trees between the camera and the caretaker still hide them (A2).
- Performance has only been measured with software rendering in a container (1–5 fps there), not on a phone.
