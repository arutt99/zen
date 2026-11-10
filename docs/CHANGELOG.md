# Changelog

## Phase 0: Fork the engine (2026-11-10)
- New TypeScript + three.js + esbuild project at the repo root; builds to one offline, installable `dist/index.html`.
- Stand-in engine (Lanternfall's source wasn't reachable from this session): quality tiers, painterly toon
  materials with brush texture, wind and outlines, a post pass, context-loss handling.
- First home island: terrain, pond, sea, trees, pines, rocks, grass, cherry tree, bench, sky and fog.
- Placeholder caretaker, damped follow camera with two zoom presets, drifting petals.
- Input: keyboard, gamepad and floating touch joystick → one move vector; one context action (sit on the bench) through the proximity rule.
- Versioned save with corrupt-save fallback and autosave on hide; settings menu (quality, sound).
- Headless sim (`src/sim`) with 21 unit tests; Playwright smoke test at phone and laptop sizes; GitHub Actions CI.
