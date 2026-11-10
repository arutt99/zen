# Tasks

**Current phase: 0, Fork the engine. Waiting at the gate.** (plan section 10)

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
- [ ] **Owner:** confirm art decision point **A1: 2D vs 3D** (current: 3D). Required before Phase 1.
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

## Phase 1: The feel (next, after A1 is confirmed)
See plan section 10. Art decision points A2 (camera) and A3 (world scale) are due at its gate.
