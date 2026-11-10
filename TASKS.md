# Tasks

**Current phase: 0, Fork the engine. Waiting at the gate.** (plan section 10)

## Phase 0: Fork the engine
- [x] TypeScript project at the repo root: build to one HTML file, serve, test, typecheck, manifest
- [ ] **Copy and trim Lanternfall's engine** (plan 9.1). *Blocked:* this session could not access
      `arutt99/eGiAdMfElS`. A stand-in engine was written instead with the same shape (see "Engine
      status" below). Next session with access: diff Lanternfall's `render/*`, `audio/*`, `core/save.ts`,
      `ui/touch.ts` and `scripts/*` against these files and swap in or merge Lanternfall's versions.
- [x] Renderer with quality tiers (Low/Medium/High/Ultra; default picked by device), context-loss handling
- [x] Painterly pipeline (stand-in): banded toon shading, brush texture, wind sway, inverted-hull outlines, post pass (grade, warm tint, paper grain, vignette)
- [x] First home island: terrain, pond with lily pads, sea, trees, pines, rocks, grass, a cherry tree, a bench; sky and fog from one daytime preset
- [x] Placeholder caretaker (capsule + head + basket) and damped follow camera with two zoom presets
- [x] Input: one move vector (keyboard, gamepad, touch joystick) + one context action (sit on the bench), via the proximity rule
- [x] Versioned save (position + settings), corrupt-save fallback, autosave on hide
- [x] Synth audio buses, pentatonic helper, bell on sit
- [x] GitHub Actions: typecheck, test, build on every push
- [x] `AGENTS.md`, `README.md`, `TASKS.md`, `docs/ART_PIPELINE.md`, `docs/CHANGELOG.md`
- [x] Unit tests (21) and a Playwright smoke test at phone and laptop sizes
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
The engine files in `src/render`, `src/audio`, `src/core/save.ts`, `src/ui/input.ts` and `scripts/` were
written fresh in Phase 0 because Lanternfall's source wasn't reachable. They follow the module split
in plan 9.1/9.3 so Lanternfall's versions can replace them file by file. Lanternfall's `render/style.ts`
look-switching, its biome presets, VFX library and synth kit are the main pieces still to bring over.

## Phase 1: The feel (next, after A1 is confirmed)
See plan section 10. Art decision points A2 (camera) and A3 (world scale) are due at its gate.
