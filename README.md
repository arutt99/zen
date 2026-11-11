# Moss & Bell

A calm, open-ended caretaking game: restore an overgrown mountain valley one branch and stone at a
time, watch it heal, follow a trail to a bamboo grove, and sit still when you want to. Phone and PC are equals, in the browser.

- **The plan:** [`Moss_and_Bell_Plan_v2.md`](Moss_and_Bell_Plan_v2.md) (v1 kept for reference)
- **Current phase and checklist:** [`TASKS.md`](TASKS.md)
- **Rules for coding agents:** [`AGENTS.md`](AGENTS.md)
- **Art rules:** [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md) · reference image [`docs/art-reference.jpg`](docs/art-reference.jpg)
- **Changes:** [`docs/CHANGELOG.md`](docs/CHANGELOG.md)

## Run it

Needs Node 20+.

```sh
npm install
npm run build      # -> dist/index.html, one self-contained offline file
npm run serve      # http://localhost:5173 (also prints a LAN address for your phone)
npm run dev        # rebuild on every change (development build, data errors shown on screen)
```

You can also open `dist/index.html` straight from disk. To try it on a phone, run `npm run serve`
on a computer on the same Wi-Fi and open the printed `phone:` address, or download the
`moss-and-bell-build` artifact from a CI run.

**GitHub Pages:** every push to `main` publishes the build to https://arutt99.github.io/zen/
(`.github/workflows/pages.yml`; it can also be run by hand from the Actions tab). One-time setup:
repo Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Checks

```sh
npm run typecheck  # strict TypeScript
npm test           # headless unit tests (sim, save, data), node:test
npm run smoke      # browser smoke test at phone and laptop sizes (needs Playwright installed)
npm run shots      # phase screenshot set into docs/phase4 (needs Playwright; slow with software GL)
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every push and keeps the built
file as a downloadable artifact.

## Controls

| Action | Phone | PC |
|---|---|---|
| Move | Floating joystick, left 60% of the screen | WASD / arrows / left stick / d-pad |
| Gather, deposit | Automatic: walk up to a tree, a mossy boulder, a bamboo clump or the build site | Automatic |
| Travel | Walk out along a trail; or the map board (once a second place is found) | Same; on the map ←/→ and E |
| Context action (sit, read, ring, rake, light, tea, map) | The round button that appears when useful | E / Space / Enter / gamepad A |
| Zoom (two presets) | Pinch | Mouse wheel, `-`/`=`, bumpers |
| Menu (quality, sound, time of day; `?trial` shows the old art trial) | ☰ button | Esc / Start |

## Engine

The engine is copied from the owner's game **Lanternfall** (`arutt99/eGiAdMfElS`, `games/lanternfall`) and
adapted; Lanternfall itself is untouched. `TASKS.md` lists which file came from where.

## Layout

```
src/
  main.ts          boot, game loop, HUD wiring
  core/            save (versioned, corrupt-safe), clock + time-of-day blending, seeded random + noise, frame pacing
  data/            places (layout, exits and arrivals, map board, sit spots, words, restoration props), buildings (+ kit styles), gathering
                   balance, feel, look presets, time-of-day presets and day cycles, characters, animals,
                   rituals, words (opening, poems, notes), quality tiers, data validation
                   (all tunable numbers live here)
  sim/             headless rules (no three.js): state (facts), progress (derived), core loop (beat,
                   gather, deposit, regrowth, exits), gather nodes, animal wandering, pacing and journey bots, island geometry,
                   proximity, walker
  render/          engine + post chain, active look, painterly materials, model builder, decor (Zen kit),
                   stage, camera, caretaker, deer, gather nodes, building kits (shelter, garden, hall, bell
                   tower, wind shrine, tea house), restoration layer, crane, mist, effects, particles
  audio/           synth kit, audio engine (buses, sound bank, ambience loops), sound recipes, ambience mix
  ui/              keyboard / gamepad / touch joystick input, touch detection
public/            HTML shell, web manifest, icon (inlined into the build)
scripts/           build, serve, test runner, browser smoke test
tests/             unit tests
```
