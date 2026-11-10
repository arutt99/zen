# Art pipeline

The rules for building and tuning art. The **target look** is the painted storybook reference,
`docs/art-reference.jpg` (plan 7.1). It is not final: the owner picks from the look presets at the Phase 2
gate (A6). Until then every model must read well in all three presets.

## Scale
- **1 unit = 1 metre.** The caretaker is ~1.8 m tall including the hair bun (placeholder), walk speed 4.2 m/s.
- Home valley floor: 48 × 36 m, plus 16 m of hills and rim (`src/data/places.ts`). Lanternfall's trees are
  4–6 m tall (about 2.5× the caretaker). **A3 decided (owner, 2026-11-10): Medium caretaker, 1.8 m.** Size every
  layout, gather and site radius, collision circle, path and building part against it.
- **Camera (A2 decided, owner, 2026-11-10): A, Classic (~40°)**, near zoom 13 m back / 11 m up, far 22 / 19, fov 34°
  (`src/data/feel.ts`). Check new models for readability at phone size from this view.
- **Resolution:** Medium, High and Ultra draw at up to 2× device pixels (`src/data/quality.ts`). Judge sharpness and
  outline width at that resolution, not at Low.

## Models
- Every model is built in code with Lanternfall's model builder `MB` (`src/render/mb.ts`): primitives with
  vertex colors (a two-color gradient bottom to top), optional wobble and puffy normals, merged into one
  geometry. `MB.build()` also adds the averaged normals the ink outline needs.
- Decor kinds live in `src/render/decor-models.ts` as `{ solid, leaf?, glow? }`: `solid` uses `Mats.std`,
  `leaf` uses `Mats.stdFoliage` (wind sway), `glow` uses `Mats.glow`. Add a kind there and to
  `DECOR_KINDS` in `src/data/validate.ts` (a test checks they match).
- Instanced wherever an item repeats (decor, grass, flowers, lily pads).

## Look presets (Phase 2, plan 7.4)
All style values live in `src/data/looks.ts`; the active look is chosen per page load (`src/render/look.ts`,
Settings → Look, or `?look=painted|lanternfall|woodblock` in the address). Shaders are generated for one
look, so switching reloads the page.

| Setting | Painted (target) | Lanternfall-like | Woodblock (wildcard) |
|---|---|---|---|
| Tone levels (shadow, mid, lit) | 0.74, 0.93, 1.08 | 0.6, 0.9, 1.22 | 0.8, 1.0, 1.0 (two tones) |
| Step softness (half-width) | 0.17 (blended) | 0.03 (hard) | 0.012 (hard) |
| Shadow tint | warm (1.0, 0.92, 0.88) | cool (0.8, 0.82, 1.08) | grey-blue (0.86, 0.88, 0.98) |
| Brush strength | 0.95 | 0.42 | 0.25 |
| Color remap (sat, lift to paper) | 0.78, 0.14 | none | 0.7, 0.1 |
| Outlines | warm brown, 1.25/720, figures + buildings | near-black, 1.9/720, everything | dark brown, 1.35/720, everything |
| Ground | soft patch edges, no path ink | crisp patches, inked path edge | crisp patches, inked path edge |
| Haze (fog ×, toward paper) | 1.35, 0.5 | 1, 0 | 1.2, 0.8 |
| Post: saturation, grain, posterize | 0.86, 0.05, off | 1, 0, off | 0.88, 0.11, 7 levels at 55% |
| Bloom (strength, radius, threshold) | 0.2, 0.6, 1.15 | 0.24, 0.5, 1.2 | 0.05, 0.4, 1.5 |

Outline classes: every mesh that should get a line calls `inked(mesh, cls)` with `'figure'` (caretaker,
animals), `'building'` (kit parts, scaffolding, lanterns, fences, bench) or `'nature'` (trees, rocks,
grass-level props; the default). Decor kinds declare theirs as `ink` in `decor-models.ts`. Flat ground
pieces (`flat: true`: raked gravel, stepping stones) never get lines or shadows.

## Time of day (Phase 2)
Presets per place and time in `src/data/presets.ts` (`home_dawn`, `home_day`, `home_golden`, `home_dusk`,
`home_night`), placed on the day by `DAY_CYCLES`, blended by `src/core/daylight.ts` (colors per channel,
eased between keys, wrapping at midnight). The painted shading is normalized for the light's strength
(`inkRef`) and then scaled by `lightLevel` (night ≈ 0.6 of day: dimmer, never dark). Lantern glow
(`glow`), fireflies, pollen and stars come from the preset too. Settings → Time follows the device clock
or a chosen moment (the debug slider).

## Canopy fade (Phase 2)
Foliage (`Mats.stdFoliage` and its outline) thins out with a dithered see-through where it sits within
~0.8–1.6 m of the line from the camera to the caretaker's chest (`FADE_GLSL` in `materials.ts`), so trees in
front never hide the caretaker. Trunks stay solid.

## Shading as copied from Lanternfall (now the "Lanternfall-like" preset)
| Setting | Where | Value | Painted target (Phase 2 retune checklist) |
|---|---|---|---|
| Tone bands | `celPatch()` in `materials.ts` | 3 bands with hard steps at 0.62–0.68 and 1.02–1.08 | softer, wider blended steps |
| Shadow tint | `celPatch()` | cool `(0.8, 0.82, 1.08)` | warm, lighter |
| Brush strength | `paint()` | 0.42 × per-material amount | higher |
| Outline | `outlineMaterial()` | near-black, 1.9/720 of screen height, on all `MB` meshes | warm brown, thinner, characters and buildings only |
| Ground | `stage.ts` terrain shader | broad painted patches with crisp edges, inked path edge | softer edges, no ink on ground |
| Post | `engine.ts` | bloom 0.24, grade from the place preset, vignette 0.32 | warmer grade, lower saturation, paper grain, distance haze |
| Classic look | `style.ts` (`?style=classic`) | smooth shading + Kuwahara paint filter + tilt-shift (High/Ultra) | a candidate for the look switcher |

## Characters (A4, Phase 2)
Proportions in `src/data/characters.ts`; both styles are 1.8 m to the top of the bun (A3; a data check holds
them within 8 cm). The caretaker (`src/render/caretaker.ts`): cream top with a crossed collar and basket
straps, brown hakama legs that swing from the hip, sandals, wide sleeves, a hair cap with bangs, side locks
and a bun with a tie, and a dot-and-line face with blush (the face has no outline). The wicker basket is
six alternating bands with ribs and a rim; sticks and pebbles fill it item by item.
The deer (`src/render/deer.ts`) follows the caretaker's style: chibi = big head, short legs; storybook =
natural proportions. It wanders by `src/sim/animals.ts`.

## Building kit library (A5, Phase 2)
`src/render/kits.ts` holds parts every building is assembled from: `floor` (footings + planks or logs),
`post`, `beam`, `screen` (shoji or woven reeds), `roof` (rows of grey tiles with a ridge, or layered thatch
with crossed ridge poles), `lantern` (glowing paper), `noren`, and per-style scaffolding. Two styles:
**temple** (the reference) and **timber** (rustic). A building's part ids are the same in every style, so
cost and build order never depend on it. A part may return a `glow` piece (drawn with `Mats.glow`).

## Zen kit decor (Phase 2)
In `decor-models.ts`: `maple`, `bamboo`, `mossy_stone`, `stone_lantern` (glowing firebox), `fence_wood`
(2 m), `fence_rope` (2 m), `raked_gravel` (r 2.4 m, flat), `stepping_stone` (flat), `lotus` (floats on
the pond). Collision radii in `SOLID_R` (`src/sim/island.ts`); flat pieces and lotus don't block.
Gather nodes show a soft ground ring as the caretaker comes within 7 m, so they read apart from decor trees.

## Phase 1 models
- Gather nodes (`src/render/nodes.ts`): built from separate parts so they can deplete one unit at a time.
  Tree: stump (0.5 m), upper trunk (2.1 m), a core puff plus one canopy puff per unit, and a notch per chop.
  Boulder: a core rock with a moss cap plus one chunk per unit. Parts ease in and out (`damp`), never pop.
- Building kits (`src/render/kits.ts`): one model per part id, in the building's local space facing +z;
  the kit for the shelter is a 2.8 × 2.4 m deck, four posts and a gabled roof. Add a part model there and
  list it in the building's `parts` (a test checks every part has a model).
- Ghost parts use a pale transparent material; the site marker is a terrain-following disc.

## Palette
Home valley, spring day: `src/data/presets.ts` (`home_day`), Lanternfall's meadow nudged toward the plan's
palette (plan 7.2). Path `#D9C39D`/`#A48A62`, water `#9CC7B8`→`#3F7F7A`, cherry blossom `#D98AA0`→`#F6D2DC`.

## Art decision points (plan 7.4)
| # | Decision | Status |
|---|---|---|
| A1 | 2D vs 3D | **Decided: 3D** (owner, 2026-11-10) |
| A2 | Camera angle, height, zoom | **Decided: camera A, Classic ~40°** (owner, 2026-11-10). Options B and C are recorded in `docs/phase1/README.md`. Trees can still hide the caretaker (Phase 2: fade canopies in between) |
| A3 | World scale and spacing | **Decided: Medium caretaker, 1.8 m** (owner, 2026-11-10). Trees and spacing unchanged |
| A4 | Character proportions | Phase 2 gate: **chibi** or **storybook** to try in Settings (`docs/phase2/README.md`) |
| A5 | Building kit style | Phase 2 gate: **temple** or **timber** to try in Settings |
| A6 | Shading family | Phase 2 gate: **Painted**, **Lanternfall-like** or **Woodblock** to try in Settings |
| A7 | Seasonal palettes | Phase 5 gate |

## External assets
None. Fonts are system fonts; all sound is synthesized. Log the source and license of any future asset here.
