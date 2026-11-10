# Art pipeline

The rules for building and tuning art. The **target look** is the painted storybook reference,
`docs/art-reference.jpg` (plan 7.1). It is not final: the owner picks from look presets in Phase 2.
Phase 0 uses a Lanternfall-like look on purpose: banded cel shading and dark outlines. Phase 2 retunes it.

## Scale
- **1 unit = 1 metre.** The caretaker is ~1.8 m tall including the hair bun (placeholder), walk speed 4.2 m/s.
- Home valley floor: 48 × 36 m, plus 16 m of hills and rim (`src/data/places.ts`). Lanternfall's trees are
  4–6 m tall; they were kept at that size for now. Scale is art decision point A3 (Phase 1 gate).

## Models
- Every model is built in code with Lanternfall's model builder `MB` (`src/render/mb.ts`): primitives with
  vertex colors (a two-color gradient bottom to top), optional wobble and puffy normals, merged into one
  geometry. `MB.build()` also adds the averaged normals the ink outline needs.
- Decor kinds live in `src/render/decor-models.ts` as `{ solid, leaf?, glow? }`: `solid` uses `Mats.std`,
  `leaf` uses `Mats.stdFoliage` (wind sway), `glow` uses `Mats.glow`. Add a kind there and to
  `DECOR_KINDS` in `src/data/validate.ts` (a test checks they match).
- Instanced wherever an item repeats (decor, grass, flowers, lily pads).

## Shading (Lanternfall's inked look, as copied)
| Setting | Where | Value | Painted target (Phase 2 retune checklist) |
|---|---|---|---|
| Tone bands | `celPatch()` in `materials.ts` | 3 bands with hard steps at 0.62–0.68 and 1.02–1.08 | softer, wider blended steps |
| Shadow tint | `celPatch()` | cool `(0.8, 0.82, 1.08)` | warm, lighter |
| Brush strength | `paint()` | 0.42 × per-material amount | higher |
| Outline | `outlineMaterial()` | near-black, 1.9/720 of screen height, on all `MB` meshes | warm brown, thinner, characters and buildings only |
| Ground | `stage.ts` terrain shader | broad painted patches with crisp edges, inked path edge | softer edges, no ink on ground |
| Post | `engine.ts` | bloom 0.24, grade from the place preset, vignette 0.32 | warmer grade, lower saturation, paper grain, distance haze |
| Classic look | `style.ts` (`?style=classic`) | smooth shading + Kuwahara paint filter + tilt-shift (High/Ultra) | a candidate for the look switcher |

## Phase 1 models (placeholders; A5 decides the building kit)
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
| A2 | Camera angle, height, zoom | **Due now (Phase 1 gate).** Three trial options in `src/data/feel.ts` (`CAMERA_OPTIONS`), switchable in Settings; see `docs/phase1/README.md`. Trees can hide the caretaker |
| A3 | World scale and spacing | **Due now (Phase 1 gate).** Three trial caretaker sizes (`SCALE_OPTIONS`); trees and spacing unchanged so far |
| A4–A6 | Character style, building kit, shading family | Phase 2 gate |
| A7 | Seasonal palettes | Phase 5 gate |

## External assets
None. Fonts are system fonts; all sound is synthesized. Log the source and license of any future asset here.
