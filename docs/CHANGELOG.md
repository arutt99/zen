# Changelog

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
