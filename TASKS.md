# Tasks

**Current phase: 2, Warm the look. Waiting at the gate.** (plan section 10)

The owner reported the Phase 0 and Phase 1 gate checks passed on their phone and PC (2026-11-10).

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
- [x] **Owner:** gate check on a real phone browser and on PC (passed, reported 2026-11-10)

### Gate checklist (owner)
- [x] `dist/index.html` opens on PC
- [x] …and in a phone browser (iPhone Safari and/or Android Chrome), landscape
- [x] The island renders with the painterly pipeline
- [x] Holds frame rate on Medium on the phone (fps shows bottom-left)
- [x] The caretaker walks around with the joystick
- [x] CI is green

### Engine status
Copied from Lanternfall (`games/lanternfall/src` at commit `b282628`); each file's first line says where it came from and what changed.

| Lanternfall | Here | Notes |
|---|---|---|
| `render/engine.ts` | `src/render/engine.ts` | quality table moved to `src/data/quality.ts`; RTS camera rig removed |
| `render/materials.ts`, `render/mb.ts`, `render/style.ts` | same paths; `style.ts` → `render/look.ts` | Phase 2: driven by the look presets (`src/data/looks.ts`) |
| `render/decor-models.ts` | same path | meadow-type kinds kept; cherry and bench added |
| `render/stage.ts`, `render/biomes.ts` | `src/render/stage.ts`, `src/data/presets.ts` | lantern, rifts, build overlay removed; biome → place preset |
| `sim/world.ts` | `src/sim/island.ts` | path + terrain + rim kept; build rules removed; pond and decor from place data |
| `render/vfx.ts` | same path | particles and rings only |
| `audio/synth-kit.ts`, `audio/audio.ts` | same paths | kit unchanged; engine trimmed to buses and sound bank (no battle score) |
| `core/util.ts`, `core/util-render.ts`, `core/pacing.ts`, `ui/touch.ts` | same paths | unchanged (`damp`, `hashString` added to util) |
| `core/save.ts` | not copied | Lanternfall's save is battle-specific; `src/core/save.ts` keeps its write-on-hide habit and adds versions, migrations and field repair |
| `scripts/*.mjs` | `scripts/` | same approach (esbuild → one inlined HTML file, node:test runner); output goes to `dist/` |
| `render/hero-models.ts` | not copied | Phase 2 built the caretaker and deer from scratch with `MB` instead (Lanternfall's heroes are fantasy-proportioned) |

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
- [x] **Owner:** picked A2 **camera A (Classic)** and A3 **Medium caretaker** after trying them on the phone (2026-11-10). Trial settings removed
- [x] Sharper image: Medium and High now draw at up to 2× device pixels (were 1.25×) after the owner found Ultra sharp and smooth on their phone
- [x] **Owner:** gate check (passed, reported 2026-11-10)

### Gate checklist (owner)
- [x] On a phone, someone new to the game gathers and builds the shelter without being told how
- [x] …and keeps gathering afterwards
- [x] Closing the tab mid-deposit and reopening keeps exactly what was delivered
- [x] Holds frame rate on Medium on the phone with the new effects (mist, particles)

### Known Phase 1 gaps
- Only the first site exists, so after the shelter there is nothing to build with what you gather (Phase 3 adds the rest). The pacing bot's 9.8 s is a perfect player on a short first loop: below the plan's ~30 s for the shelter and 30–90 s cycle target. Real players walk less directly; the target is checked properly once Phase 3 adds the longer buildings.
- Gather trees look like decor trees (only the boulders got a moss cap to tell them apart). A gentle highlight or a distinct gatherable tree kind would help new players; Phase 2's Zen kit is the place for it.
- In mixed-material buildings, parts of one material can appear before the parts of another that sit under them (deposits are per material). Only matters from the gravel garden on; to settle with A5 (the building kit) in Phase 2.
- Trees between the camera and the caretaker still hide them (A2).
- Performance has only been measured with software rendering in a container (1–5 fps there), not on a phone.

## Phase 2: Warm the look
See plan section 10. Owner choices before the build (2026-11-10): wildcard look = **woodblock print**; two
caretaker styles (**chibi** + **storybook**); two kits on the shelter (**temple** + **timber**).

- [x] Look presets in `src/data/looks.ts`: **Painted** (plan 7.1 retuning checklist applied), **Lanternfall-like**, **Woodblock** (wildcard). Look switcher in Settings (reloads); `?look=` for screenshots
- [x] Every shader reads the look: tone steps and softness, shadow tint, brush, color remap, outline color/width/classes, ground edges, grass, haze, bloom, grade, paper grain, posterize
- [x] Time of day: dawn, day, golden hour, dusk, night presets, blended from the clock (`src/core/daylight.ts`); lantern glow, fireflies, stars; Settings → Time (follow clock / choose) with a debug slider
- [x] The real caretaker (robe, hakama, bun, face, sandals, wicker basket that fills) in two proportion styles (A4)
- [x] The deer, in the same styles, with a headless wander rule; arrives with restoration (temporarily the shelter's level, Phase 3 moves it to the gravel garden)
- [x] Building kit library (footings, floors, posts, beams, screens, roofs, lanterns, noren, scaffolding) in two styles (A5); the shelter assembled from it
- [x] Zen kit decor: maple, bamboo, mossy stone, stone lantern, wooden and rope fences, raked gravel, stepping stones, lotus; placed in the home valley for review
- [x] Tree and boulder depletion/regrowth states (Phase 1 views, kept) plus a ground ring that marks gatherable nodes as you approach
- [x] Canopy fade between the camera and the caretaker (the A2 occlusion gap)
- [x] Save v3 (v2 migrates); unit tests; browser smoke test
- [x] Screenshot sets of every preset at phone size, day and dusk, plus caretaker and kit styles: [`docs/phase2/README.md`](docs/phase2/README.md)
- [x] **Painted+** look (owner request, 2026-11-10: move a bit toward a soft-lit diorama): baked occlusion,
  contact shadows, softer sun shadows, lines on figures only, and a detail pass on stones, crowns, the pond
  edge, the stone lantern and the temple shelter. Side-by-side screenshots in `docs/phase2/README.md`
- [x] **Lanternfall+** look (owner leans toward Lanternfall-like for its crisp bands, ink on everything, rich
  color and no grain/haze): Lanternfall-like plus Painted+'s occlusion, contact shadows and detail pass
- [ ] **Owner:** try the looks, caretakers and kits on the phone and decide **A4, A5, A6** (see `docs/phase2/README.md`)
- [ ] **Owner:** gate check (below)

### Gate checklist (owner)
- [ ] Tried the three looks on the phone and picked a direction (A6)
- [ ] Picked a caretaker style (A4) and a building kit style (A5)
- [ ] If Painted: a phone screenshot next to `docs/art-reference.jpg` reads as the same world, not as Lanternfall
- [ ] Holds frame rate on Medium on the phone in the chosen look, by day and at night (fps bottom-left)
- [ ] Then: `docs/ART_PIPELINE.md` records the final values, and the unpicked options are removed

### Known Phase 2 gaps
- The time-of-day presets only change light, sky, fog, water and particles; ground and foliage colors stay the day's (seasons, Phase 5, will add palettes).
- The deer's arrival is tied to the shelter for now (plan 4.2 says the gravel garden, Phase 3).
- Fences block only at their middle (one collision circle per prop); they're placed off the walking routes. A segment collider comes with Phase 3's layout work.
- The Zen-kit pieces are placed for review, not as the final valley layout (Phase 3).
- Switching the look reloads the page; caretaker, kit and time switch live.
- Painted+ and Lanternfall+: the occlusion bake adds load time (about 0.25 s more on a desktop; a phone is untested, estimate
  ~1 s). Frame cost should be close to Painted (same draw calls plus one small ground texture, but about twice
  the vertices in trees and the shelter); not measured on a phone yet.
- Painted+: the timber kit has no detail pass yet (it gets the occlusion and shadows). The pond edge stones
  are not in the collision setup (they sit at the water line, past where the caretaker can walk).
- Painted+: the build site's ground shadow is one channel for all sites (fine with one site; Phase 3 adds more).
- All screenshots and frame rates here come from software rendering in a container (a few fps), not from a phone.
