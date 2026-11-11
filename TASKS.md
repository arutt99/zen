# Tasks

**Current phase: 4, The first journey. Built; waiting at the gate (owner checks below).** The owner asked to go
on to Phase 4 before checking Phase 3's gate (2026-11-10), so Phase 3's gate items and approvals, and Phase 2's
PC frame-rate check, are still open and carry over. (plan section 10)

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
- In mixed-material buildings, parts of one material can appear before the parts of another that sit under them (deposits are per material). Only matters from the gravel garden on; settle with the first mixed-material building in Phase 3 (A5 is decided: timber).
- Trees between the camera and the caretaker still hide them (A2).
- Performance has only been measured with software rendering in a container (1–5 fps there), not on a phone.

## Owner direction notes (2026-11-10)
- **Story frame, chapter 1:** the caretaker is on a mindfulness journey and stumbles on an old Zen monastery
  to fix up (plan 4.5). Opening text and the walk-in are drafted in Phase 3.
- **A future mindfulness edition:** two versions, the calm world-building game and one that adds real-time
  meditations and moments of reflection with guidance (plan 13). Noted, not planned; no work until later.
- **Tending the grounds (2026-11-11):** upkeep as one of the main things you do: raking leaves and snow off
  paths, picking up fallen sticks, cleaning and tidying the monastery and grounds (plan 14). Owner decided: no
  reward, no interiors, tools chosen by hand from a tool row (walking on leaves without the rake never rakes).
  Scheduled as **Phase 4b** after Phase 4's gate (agent's recommendation, accepted). Snow and seasonal leaf
  colours wait for Phase 5 and A7.

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
- [x] Lanternfall+ **rich** detail (owner: PC first, all six ideas): leafy inked crowns, roots, inked wood/bark/
  stone marks, ground dressing, pond ripples/shoreline/koi, butterflies, drifting leaves, bobbing lotus,
  swaying lantern, lantern light at night
- [x] **Owner:** decided **A6: Lanternfall+** (2026-11-10). Plan 7.1, AGENTS.md and ART_PIPELINE updated
- [x] **Owner:** decided **A4: chibi** (locked) and **A5: timber as the default style**, with temple kept as a
  style to choose per building later (Phase 5 decorating), 2026-11-10. The Art trial menu is hidden
  (`?trial` shows it); the game always opens in Lanternfall+, chibi, timber
- [ ] **Owner:** gate check (below)

### Gate checklist (owner)
- [x] Picked a direction (A6): **Lanternfall+**, judged on PC (owner set phones aside for now)
- [x] Picked a caretaker style (A4: chibi) and a building kit style (A5: timber by default)
- [x] ~~If Painted: a phone screenshot next to the reference~~ (not applicable: Lanternfall+ chosen)
- [ ] Holds frame rate on the owner's PC in Lanternfall+, by day and at night (fps bottom-left). Phone check deferred by the owner
- [x] `docs/ART_PIPELINE.md` records the decisions; the unpicked options are out of the menu
- [x] Unpicked options removed from the code (Painted, Painted+, Woodblock looks; storybook proportions), at
  the start of Phase 3. Plain Lanternfall stays as the light look the smoke test drives (software GL can't run
  Lanternfall+ fast enough). Temple stays: it's a future style choice

### Done at the start of Phase 3
- [x] **Timber detail pass, roofs first**: layered thatch bundles with a ragged eave, a bound ridge with crossed,
  lashed poles and a little moss, rafter poles and purlins under the eaves, bark grain and rope lashings, a firmer
  log floor (`thatchSide`, `thatchRidge`, `timberFloor` in `src/render/kits.ts`; Lanternfall+ only)
- [x] The unpicked looks and storybook proportions removed from the code

### Known Phase 2 gaps
- The time-of-day presets only change light, sky, fog, water and particles; ground and foliage colors stay the day's (seasons, Phase 5, will add palettes).
- The deer's arrival is tied to the shelter for now (plan 4.2 says the gravel garden, Phase 3).
- Fences block only at their middle (one collision circle per prop); they're placed off the walking routes. A segment collider comes with Phase 3's layout work.
- The Zen-kit pieces are placed for review, not as the final valley layout (Phase 3).
- Switching the look reloads the page; caretaker, kit and time switch live.
- **Phones set aside by the owner for the Lanternfall+ rich pass (2026-11-10): PC first.** The plan still
  treats phone and PC as equals; before Lanternfall+ ships to phones it needs a phone budget (fewer
  dressing pieces, no stone cracks, fewer leaf clumps on Medium) and a frame-rate check.
- Lanternfall+ rich: ~4× the vertices of Lanternfall-like in decor and kits, ~0.6 s more model building at
  load on a desktop; the pond reflection is a tint of the bank, not a real reflection; leaves can settle
  on the path; butterflies fly through trunks now and then.
- Painted+ and Lanternfall+: the occlusion bake adds load time (about 0.25 s more on a desktop; a phone is untested, estimate
  ~1 s). Frame cost should be close to Painted (same draw calls plus one small ground texture, but about twice
  the vertices in trees and the shelter); not measured on a phone yet.
- Painted+: the timber kit has no detail pass yet (it gets the occlusion and shadows). The pond edge stones
  are not in the collision setup (they sit at the water line, past where the caretaker can walk).
- Painted+: the build site's ground shadow is one channel for all sites (fine with one site; Phase 3 adds more).
- All screenshots and frame rates here come from software rendering in a container (a few fps), not from a phone.

## Phase 3: Home grows
See plan section 10. Builds on decided art only (A1–A6); A7 (seasonal palettes) is untouched until Phase 5.

- [x] Start-of-phase work: the unpicked looks and storybook removed; the timber detail pass, roofs first
- [x] **All home-valley buildings except the tea house** (plan 9.6): the shelter (6 wood), **gravel garden**
  (4 wood, 6 stone), **meditation hall** (14 wood, 10 stone) and **bell tower** (10 wood, 8 stone), each one part
  per unit, built in timber (the kit helpers draw temple too, for Phase 5's per-building styles)
- [x] **Sites reveal themselves in turn** (`requires` in `src/data/buildings.ts`, `siteOpen` in
  `src/sim/progress.ts`): a hidden site has no marker, ghost or deposits; when the building before it completes,
  its marker and ghost fade in with a chime
- [x] **Mixed materials settled**: each part rests only on the ground or on an earlier part of its own material
  (`on`), checked by the data validator and a test over every wood/stone mix, so no part ever floats
- [x] The valley laid out for the whole chapter: four sites, 10 trees and 7 boulders spread out, the path from the
  old gate to the hall's steps, sit spots, poem stones and notes (`src/data/places.ts`)
- [x] **Restoration across the valley** (plan 3.4, `growth` in place data, `src/render/growth.ts`): brambles and
  tall weeds recede, flower beds and iris spread, path lanterns arrive with the hall, a young cherry and the open
  trail gate with the bell tower; each grows in or withers over a few seconds. The pond clears (murk) by the gravel
  garden; tired, browner ground greens up as restoration rises; mist lifts with the shelter. Animals: the deer now
  arrives with the gravel garden (plan 4.2)
- [x] **Real-clock time of day with settings**: Settings → Time: follow my clock / always day / choose (slider)
- [x] **Sit and watch** at four spots (the bench; the shelter's deck, the garden's bench and the hall's step once
  built): HUD fades, camera eases out, ambience lifts, the deer drifts closer and rests nearby
- [x] **Rituals** (unrewarded, nothing saved): **Ring** the bell tower (bell and striker swing, deep bell, a ring
  spreads over the ground), **Rake** the gravel (the other pattern is raked in), **Light** the path lanterns at
  dusk and night (one by one; they go out at dawn)
- [x] **Poem stones (4) and caretaker notes (3)**: walk up and Read; the first read joins the collection (a saved
  fact for Phase 5's book). All text is original and a **draft** (shown with a small PLACEHOLDER tag) for the owner
- [x] **Chapter 1 opening** (plan 4.5): the game begins just inside an old timber gate at the valley's south end;
  three lines fade in one after another on the first visit only (`OPENING` in `src/data/words.ts`, draft)
- [x] **Audio pass 1**: ambience loops (birds and the stream by day, crickets and wind at night; fewer birds in a
  neglected valley; sitting lifts it), a deep temple bell for the ritual, rake, lantern, page and site-reveal
  sounds. Wood (marimba) and stone (ceramic tap) gathering timbres kept from Phase 1
- [x] **Reads with sound muted**: every sound has a visual (bell → swing + ground ring; reveal → marker fade-in and
  dust; words → card; gathering and building as before)
- [x] Save v4 (v3 migrates): `collection` and `opened`. Facts only; everything else is derived on load
- [x] Pacing bot plays the whole valley; a "relaxed" style stands in for a calm player (see gaps)
- [x] Unit tests 58 → 71 (new: `tests/phase3.test.ts`); the browser smoke test also checks that later sites stay
  hidden and that a read poem survives a reload
- [x] Screenshots: [`docs/phase3/README.md`](docs/phase3/README.md)
- [ ] **Owner:** approve or rewrite the opening, poems and notes (all drafts), and confirm the start at the gate
  (plan 4.5 open decision: walk in vs start at the gate)
- [ ] **Owner:** gate check (below)

### Gate checklist (owner)
- [ ] From a fresh save the home valley is completable in about 10–15 minutes (see the pacing gap below)
- [ ] Before and after look clearly different
- [ ] The game reads with sound muted
- [ ] (carried over from Phase 2) Holds frame rate on the owner's PC in Lanternfall+, by day and at night

### Known Phase 3 gaps
- **Pacing may come in under 10–15 minutes.** The pacing bot builds the valley in ~2 min playing perfectly and
  ~2.8 min as a "relaxed" player who knows where everything is. A first-time player also finds the sites, reads
  seven pieces of writing, sits and tries rituals, so my estimate is 6–10 minutes, but **nobody has played it
  yet**. If it's short, the levers are data only: costs in `src/data/buildings.ts` (plan 9.6 numbers today),
  units per node and regrowth in `src/data/gathering.ts`, and node spacing in `src/data/places.ts`.
- Collision is one circle per building: the hall's corners and its two stone lanterns, and the poem stones and
  note posts, can be walked into a little. Fences still block only at their middle.
- Path lanterns stay lit only until dawn and only in this session's memory (rituals save nothing, by design).
- The trail gate opens but leads nowhere yet (Phase 4 walks it to the bamboo grove).
- Restoration props are placed by hand; overgrowth isn't solid (nothing ever appears in the caretaker's way).
- Lanternfall+ light slots: 8 lanterns light the ground at once, the 8 nearest the caretaker.
- All screenshots and the smoke test come from software rendering in a container (about 1 fps); nothing in this
  phase has been checked on a phone or on the owner's PC.

## Phase 4: The first journey
See plan section 10. Builds on decided art only (A1–A6); A7 (seasonal palettes) is untouched until Phase 5.
Started at the owner's request with Phase 3's gate still open (2026-11-10).

- [x] **Places you travel between** (plan 4.1): `main.ts` now builds everything that belongs to one place (world,
  stage, loop, nodes, buildings, restoration layer, animals, sit spots, words, rituals, map board) in `enter()` and
  tears it down on travel; facts, caretaker, camera, HUD and settings stay. Travel fades to paper, builds the next
  place, and fades back in; it saves on both sides
- [x] **The trail, walked the first time**: past the bell tower a packed-earth trail leads through the (now open)
  trail gate; walking out at its end travels to the grove (`exits` in `src/data/places.ts`, an `exit` proximity
  target in `src/sim/loop.ts`, priority above everything). The shut gate blocks the way and a shut exit never
  fires. The grove's own trail runs on from its south end back to the valley
- [x] **The bamboo grove** (`bamboo_grove`): a long valley of tall bamboo with a trail winding up past a spring pool
  to the shrine's clearing; its own light along the same day (`grove_*` presets), mist and murky water before the
  shrine, fallen culms, brambles and weeds that recede; ferns, iris, flowers and trail lanterns (lit by
  themselves at dusk) that come with it. A first-arrival line (draft)
- [x] **Bamboo**, the new material: 8 clumps in the grove, one culm per unit (4 per clump, regrowing in 22 s), a
  hollow-knock note on the pentatonic scale, bamboo in the basket, the HUD and the flying items
- [x] **The wind shrine** (4 stone, 8 bamboo; grove restoration 0 → 1): stone platform, bamboo posts, a
  split-bamboo roof and wind chimes that sway; its chimes join the grove's ambience once restored
- [x] **The crane** arrives with the shrine and wades the spring pool, dips its bill, rests on one leg, and drifts
  closer when you sit (the deer's wander rule)
- [x] **Grove poem stones (2), a caretaker note at the shrine and sit spots (3)**: the trail bench, the pool stone
  and the shrine's step (once restored). All text is draft (PLACEHOLDER tag)
- [x] **The travel map** (plan 4.1): a painted map on a board by the home valley's trail gate and by the grove's
  shrine; it opens once a second place has been found and travels by fade to the other place's map board
  (tap/click a place; keys: ←/→ and E)
- [x] **The tea house at home** (6 wood, 8 bamboo; plan 9.6): its site reveals itself once the grove's shrine is
  restored (a site can now wait on a building in another place: `completedAll` in `src/sim/progress.ts`). Bamboo
  walls, a fenced garden, a **water pipe that fills, tips and tocks** (heard nearby, always seen as a splash), and
  touches that arrive with it (a lantern, flowers, a bamboo fence, a note)
- [x] **The tea ritual**: kneel at the bench, the tea is poured, steam curls up; any input stands up early
- [x] Audio: bamboo knock, the water pipe's tock, pouring, a travel sound; grove ambience (bamboo rustling, a
  smaller spring, fewer birds, the shrine's chimes once restored)
- [x] Save v5 (v4 migrates): `places` (places found). The place you're in is saved with your position; a reload
  anywhere lands you there (or at that place's way in if the spot no longer stands up). Nothing else is new: all
  of the journey is derived from deposits and places found
- [x] Journey bot (`runJourneyBot`): plays the gate route with the real rules: home valley → trail → shrine and
  bamboo → trail back → tea house
- [x] Unit tests 71 → 85 (`tests/phase4.test.ts`, with a flood-fill reachability check of everything in both
  places); the browser smoke test adds a journey run (walk out, cut bamboo, reload in the grove, map home)
- [x] Screenshots: [`docs/phase4/README.md`](docs/phase4/README.md)
- [ ] **Owner:** approve or rewrite the new words (2 poems, 2 notes, the grove's arrival lines; all drafts)
- [ ] **Owner:** gate check (below)

### Gate checklist (owner)
- [ ] Walk to the grove (through the trail gate once the bell tower is built)
- [ ] Restore the wind shrine
- [ ] Bring bamboo home and build the tea house
- [ ] Travel back by the map
- [ ] Reloading at any point lands you somewhere sensible with nothing lost
- [ ] (carried over) Phase 3's gate and Phase 2's PC frame-rate check, now in both places

### Known Phase 4 gaps
- **Pacing is short again.** The plan says the first journey adds 10–15 minutes. The journey bot does the grove
  and the tea house in ~1.1 min playing perfectly and ~1.4 min "relaxed" (it knows the way; a first visit also
  walks the trail, reads, sits and finds the map). Same levers as Phase 3, all data: costs, units per clump,
  and how far the clumps sit from the shrine. I'd rather you play it first.
- **The map board's place is my choice:** the plan says "at the home gate"; I put it by the **trail gate** (where
  journeys start), not by the old gate at the south end. Moving it is one line of data.
- Arriving at a place rebuilds it while the screen is paper-coloured. On a desktop that should take well under a
  second in Lanternfall+; it is not measured (software GL here takes much longer), and not on a phone.
- The plan also lists **bamboo fence decor** and the **water pipe** as home unlocks: the water pipe and a bamboo
  fence come with the tea house; free placement of decor is Phase 5 (decorating).
- The shut trail gate blocks the gate itself; the open valley floor beside it can be walked round, but a shut exit
  never fires, so it only leads to the valley's quiet back corner.
- The trail between places is the two places' own trails, not a separate trail map (a fade covers the join).
- Collision is still one circle per building: the tea house's fences and bench and the shrine's posts can be
  walked into a little.
- The grove's background bamboo is the Phase 2 decor clump (big flat leaf ovals); a finer bamboo crown would suit
  the grove (a cheap detail pass, listed in `docs/phase4/README.md`).
- All screenshots and the smoke test come from software rendering in a container; nothing in this phase has been
  checked on a phone or on the owner's PC.

## Phase 4b: Tending the grounds (not started; after Phase 4's gate)
See plan section 14 and section 10. Owner decisions 2026-11-11: no reward, no interiors, tools chosen by hand.

- [ ] Tools as saved facts: rake (shelter), broom (hall), cloth (by the water); found once, kept
- [ ] Tool row: 1–3 / 0 / Q / scroll on PC, shoulder button on gamepad, a tool button on phone; the tool shows
  in the caretaker's hands. With no tool chosen nothing tidies
- [ ] Proximity priority site > node > tidy > context (a held tool never blocks the core loop)
- [ ] Leaf layer on paths and lawns (today's colours), raked patch by patch on the beat into growing piles
- [ ] Sticks under trees, picked up with the rake and carried to a kindling stack by the shelter
- [ ] Sweeping steps and decks; wiping lanterns, poem stones and the bell (grime and moss fade per stroke)
- [ ] Mess comes back over real days up to a gentle cap, derived from "last tidied" facts and the clock
- [ ] Phase 2's drifting leaves settle onto the leaf layer
- [ ] Save v6 (v5 migrates); unit tests; smoke test (tool row, half-raked path survives reload)
- [ ] **Owner:** gate check (plan section 10, Phase 4b)
