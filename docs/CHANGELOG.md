# Changelog

## Pacing pass after the Phase 4 gate (2026-11-11)
- Owner: "way too quick" (the whole journey in 1:30). **Building parts are cut into pieces**: each modelled part
  takes 1–8 units, and every unit lands one piece, bottom-up (footings, then sleepers, then logs; rafters, then
  thatch from the eave up), so nothing jumps from 0 to 100%. Once a part's pieces have all settled, it is drawn
  as one model again, so a finished building costs no more to draw than before.
- About 3.3× the units in all (84 → 279). Trees, boulders and bamboo clumps hold 3 units (were 5, 5, 4) and
  regrow more slowly, so gathering ranges further. The tea house needs at most one satchel of bamboo.
- Bots: perfect 3.1 → ~11 min for the whole journey, relaxed 4.2 → ~15 min. The relaxed bot's walking got a
  progress watchdog (it could circle in a pocket by the pond).
- **Save v6**: a v5 save keeps exactly what it had built (old part counts become the units of those parts).
- Tests 85 → 87: pieces in every look and style, bottom-up, extras on the last piece; v5 → v6 migration;
  pacing floors. New screenshots of half-assembled parts in `docs/phase4/pacing/`.

## Phase 4: The first journey (2026-11-10)
- **Places you travel between:** the game now builds one place at a time and fades between them; facts, the
  caretaker, camera, HUD and settings carry over. Travel saves on both sides.
- **The trail:** a trail past the bell tower through the open trail gate, walked the first time, to a new place,
  **the bamboo grove**: tall bamboo, a spring pool, its own light along the same day, and an old wind shrine.
- **Bamboo**, a new material (8 clumps, a culm per unit, a hollow knock on the scale). **The wind shrine**
  (4 stone, 8 bamboo) heals the grove and brings **the crane**. Two poem stones, a note and three sit spots.
- **The travel map** on a board by the trail gate and by the shrine, once the grove has been found.
- **The tea house at home** (6 wood, 8 bamboo) reveals itself once the shrine is restored: bamboo walls, a
  fenced garden, a water pipe that tocks, and **the tea ritual**.
- Audio: bamboo, tock, pouring, travel; grove ambience with rustling bamboo and the shrine's chimes.
- Save v5 (v4 migrates): places found. Journey bot for the gate route. Unit tests 71 → 85; the smoke test
  walks the journey. Screenshots in `docs/phase4/`.

## Phase 3: Home grows (2026-11-10)
- **Start of phase:** the unpicked looks (Painted, Painted+, Woodblock) and storybook proportions are gone from
  the code; plain Lanternfall stays as the light look for the smoke test. **Timber detail pass, roofs first:**
  thatch bundle courses with a ragged eave, a bound ridge with crossed, lashed poles and moss, rafters and
  purlins, rope lashings and a firmer log floor.
- **The home valley:** the gravel garden, meditation hall and bell tower join the shelter (plan 9.6 costs), each
  growing one part per unit. Sites reveal themselves in turn. Each part rests only on the ground or on its own
  material, so any mix of wood and stone deliveries looks whole (the Phase 1 mixed-material gap, settled).
- **Restoration across the valley:** overgrowth recedes, flowers and iris spread, path lanterns come with the
  hall, a young cherry and an open trail gate with the bell tower; the pond clears and tired ground greens.
  The deer now arrives with the gravel garden.
- **Stillness, rituals and words:** four sit spots (the deer drifts closer while you sit); ring the bell, rake
  the gravel, light the path lanterns at dusk; four poem stones and three caretaker notes (draft text for the
  owner), read once into a saved collection. Chapter 1 begins at an old gate with a three-line opening (draft).
- **Time:** Settings → Time adds "Always day".
- **Audio pass 1:** ambience by time of day (birds and stream by day, crickets and wind at night, quieter in a
  neglected valley, lifted while sitting); a deep temple bell, rake, lantern, page and reveal sounds. Every sound
  has a visual counterpart.
- Save v4 (v3 migrates): collection and the opening flag. Pacing bot covers the whole valley, with a relaxed style.
- Unit tests 58 → 71; the smoke test checks hidden sites and a poem read across a reload. Screenshots in
  `docs/phase3/`.

## Phase 2 gate decisions (2026-11-10)
- **A4 decided: chibi** (locked). **A5 decided: rustic timber is the default building style**; temple stays as a
  future per-building style choice (Phase 5). A timber detail pass, roofs first, is queued for a future session.
- The Art trial menu is hidden (`?trial` shows it); the game always opens in Lanternfall+, chibi and timber.
  The default saved kit is now timber.

## Decisions and direction (2026-11-10)
- **A6 decided: Lanternfall+.** Plan 7.1 rewritten (Lanternfall's crisp inked look, grounded and richly
  detailed; Moss & Bell reads as Lanternfall's sibling on purpose). AGENTS.md's art rule and
  `docs/ART_PIPELINE.md` updated. PC first; phone budget deferred.
- **Story frame:** chapter 1 is a mindfulness journey that stumbles on an old Zen monastery to fix up (plan 4.5).
- **Noted for later:** a mindfulness edition with real-time meditations and reflection (plan 13).

## Phase 2 follow-up: Lanternfall+ goes richer (2026-11-10)
- Owner: "ditch the worry about the phone right now and just focus on PC", do all six detail ideas.
  Lanternfall+ now builds a new **rich** detail level: leafy inked crowns with roots and twigs; inked wood
  grain, bark and stone cracks; ground dressing (path edging, pebbles, moss, petals, clover, twigs); a
  livelier pond (bank reflection, inked ripples and shoreline, koi); life (butterflies, drifting leaves,
  bobbing lotus and lily pads, a swaying paper lantern); and lantern light on the ground at dusk and night.
  Painted+ and the other looks are unchanged.
- 1 new unit test; screenshots in `docs/phase2/README.md`.

## Phase 2 follow-up: Lanternfall+ (2026-11-10)
- New trial look **Lanternfall+**: Lanternfall-like's crisp bands, ink lines on everything, rich color and no
  grain or haze (what the owner likes about it), with Painted+'s baked occlusion, contact shadows and detail
  pass. Settings → Look, or `?look=lanternfallplus`. Screenshots in `docs/phase2/README.md`.

## Phase 2 follow-up: Painted+ (2026-11-10)
- New trial look **Painted+** (owner request: "move in that direction a bit", toward a soft-lit diorama):
  Painted's warm palette and brushwork with baked ambient occlusion in every model, soft contact shadows on
  the ground and under the caretaker and deer, softer sun-shadow edges, lines on figures only, and a detail
  pass: rounded stones, lumpy leaf-mass crowns with branches, a stone-edged pond, rounder path stones, a finer
  stone lantern and a more detailed temple shelter (tile courses, rafter ends, fascia, footings). Settings →
  Look, or `?look=paintedplus`. The other three looks are unchanged.
- 4 new unit tests (`tests/paintedplus.test.ts`); screenshots in `docs/phase2/README.md`.

## Phase 2: Warm the look (2026-11-10)
- **Look presets** (`src/data/looks.ts`, plan 7.4) and a look switcher in Settings: **Painted** (the reference,
  with the plan 7.1 retuning checklist applied), **Lanternfall-like** (the Phase 0 look) and **Woodblock print**
  (the wildcard, owner pick). Each sets tone steps and softness, shadow tint, brush, a global color remap,
  outline color/width and which objects get lines (figures, buildings, nature), ground patch and path edges,
  grass, haze, bloom, grade, paper grain and posterizing. Lanternfall's ink/classic switch (`style.ts`) is gone.
- **Time of day**: dawn, day, golden hour, dusk and night presets for the home valley, blended from the device
  clock (`src/core/daylight.ts`). Lanterns glow and fireflies come out at night; night is dimmer, never dark.
  Settings → Time: follow my clock, or choose a moment with the debug slider.
- **The caretaker** rebuilt after the reference (cream top, brown hakama, bun, dot-and-line face, sandals,
  woven basket that still fills item by item), with legs and arms that swing, in two proportion styles to
  compare (A4): **chibi** and **storybook**.
- **The deer**: a model in the same two styles and a headless wander rule (`src/sim/animals.ts`): it walks in
  once the valley's restoration reaches its level, grazes, rests, and steps away from a caretaker who walks
  right up to it. Temporarily tied to the shelter so it can be seen now; Phase 3 moves it to the gravel garden.
- **Building kit library** (A5): footings, floors, posts, beams, screens, roofs, lanterns, noren and
  scaffolding in two styles, **temple** and **timber**; the shelter is assembled from it. Switch in Settings.
- **Zen kit decor**: maple, bamboo, mossy stones, stone lanterns, wooden and rope fences, raked gravel,
  stepping stones and lotus, placed around the home valley for review; maple and bamboo join the groves.
- **Canopy fade**: foliage between the camera and the caretaker thins out, so trees no longer hide them.
- Gather trees and boulders show a soft ground ring as you approach, so they read apart from decor.
- Save v3 (v2 migrates): look, caretaker style, kit style and time setting.
- `scripts/shots.cjs` captures the screenshot sets in `docs/phase2/`.
- Unit tests 41 → 52 (new: looks, clock and day blending, caretaker heights, deer wandering, Zen-kit placement, kit styles, save v3 migration).

## Phase 1 follow-up (2026-11-10)
- Art decision points decided by the owner: **A2 camera A (Classic)**, **A3 Medium caretaker (1.8 m)**. The
  camera and caretaker-size trial settings were removed; older saves that picked another option fall back.
- Sharper image: the Medium and High quality tiers draw at up to 2× device pixels instead of 1.25×.

## Phase 1: The feel (2026-11-10)
- The core loop runs headless in `src/sim`: `state.ts` (facts + events), `progress.ts` (derived), `nodes.ts`,
  `loop.ts` (beat clock, gather, deposit, regrowth via the proximity rule) and `pacing-bot.ts`.
- Balance and feel as data: `src/data/gathering.ts`, `buildings.ts`, `feel.ts`; nodes, the shelter site and
  the mist in `places.ts`. Boot validation covers all of it.
- Automatic, animated chopping and chipping on a 0.55 s beat with climbing pentatonic notes; trees and
  boulders deplete piece by piece and regrow gradually; the basket fills item by item; HUD carry chip.
- The shelter grows one part per unit delivered (ghost outline, scaffolding, parts arcing in), completes
  with the bell, petals and a camera ease-out, and lifts the valley's mist.
- Movement: harder braking on reversal; collisions with nodes and the shelter.
- Save v2 with a migration from v1; deposits are saved the moment they happen.
- Art decision points A2 and A3 offered as trial settings, with screenshots in `docs/phase1/`.
- 41 unit tests (16 new); the browser smoke test now plays the loop and checks a reload.

## Phase 0: Fork the engine (2026-11-10)
- New TypeScript + three.js + esbuild project at the repo root; builds to one offline, installable `dist/index.html`.
- Lanternfall's engine copied in and trimmed (commit `b282628`): renderer and post chain, quality tiers,
  painterly materials with ink outlines, model builder, decor models, island generator, stage (terrain,
  water, sky, clouds, grass, flowers, islets, rays, ambient particles), particles, synth kit and audio
  engine, frame pacing and automatic resolution, touch detection. A stand-in engine written earlier the
  same day (while Lanternfall wasn't reachable) was replaced.
- First home island: a valley with a pond, packed-earth path, groves, rocks, a cherry tree and a bench.
- Placeholder caretaker (built with Lanternfall's model builder) and a damped follow camera with two zoom presets.
- Input: keyboard, gamepad and floating touch joystick → one move vector; one context action (sit on the bench) through the proximity rule.
- Versioned save with corrupt-save fallback and autosave on hide; settings menu (quality, sound).
- Art decision point A1 decided by the owner: the world is 3D.
- Headless sim (`src/sim`) with 25 unit tests; Playwright smoke test at phone and laptop sizes; GitHub Actions CI.
