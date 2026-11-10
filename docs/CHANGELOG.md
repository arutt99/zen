# Changelog

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
