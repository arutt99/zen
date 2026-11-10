# Changelog

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
- Headless sim (`src/sim`) with 25 unit tests; Playwright smoke test at phone and laptop sizes; GitHub Actions CI.
