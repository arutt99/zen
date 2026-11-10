# Art pipeline

The rules for building and tuning art. **The look is decided: Lanternfall+** (A6, owner, 2026-11-10; plan
7.1): crisp three-tone bands, ink outlines on everything, rich color, no grain or haze, baked occlusion and
contact shadows, and the rich detail level. New models are built and judged in Lanternfall+ (`?look=lanternfallplus`)
on a PC first. The other presets stay in the switcher until the Phase 2 gate closes (A4 and A5), then go.
`docs/art-reference.jpg` remains the reference for the Japanese garden vocabulary and the caretaker's look.

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
Settings → Look, or `?look=painted|paintedplus|lanternfall|lanternfallplus|woodblock` in the address). Shaders are generated for one
look, so switching reloads the page.

| Setting | Painted (target) | Painted+ | Lanternfall-like | Woodblock (wildcard) |
|---|---|---|---|---|
| Tone levels (shadow, mid, lit) | 0.74, 0.93, 1.08 | 0.72, 0.94, 1.1 | 0.6, 0.9, 1.22 | 0.8, 1.0, 1.0 (two tones) |
| Step softness (half-width) | 0.17 (blended) | 0.24 (very soft) | 0.03 (hard) | 0.012 (hard) |
| Shadow tint | warm (1.0, 0.92, 0.88) | warm (1.0, 0.91, 0.86) | cool (0.8, 0.82, 1.08) | grey-blue (0.86, 0.88, 0.98) |
| Brush strength | 0.95 | 0.62 (cleaner surfaces) | 0.42 | 0.25 |
| Color remap (sat, lift to paper) | 0.78, 0.14 | 0.84, 0.1 | none | 0.7, 0.1 |
| Outlines | warm brown, 1.25/720, figures + buildings | warm brown, 1.0/720, figures only | near-black, 1.9/720, everything | dark brown, 1.35/720, everything |
| Ground | soft patch edges, no path ink | softer patch edges, no path ink | crisp patches, inked path edge | crisp patches, inked path edge |
| Haze (fog ×, toward paper) | 1.35, 0.5 | 1.2, 0.45 | 1, 0 | 1.2, 0.8 |
| Post: saturation, grain, posterize | 0.86, 0.05, off | 0.9, 0.03, off | 1, 0, off | 0.88, 0.11, 7 levels at 55% |
| Bloom (strength, radius, threshold) | 0.2, 0.6, 1.15 | 0.26, 0.6, 1.05 | 0.24, 0.5, 1.2 | 0.05, 0.4, 1.5 |
| Baked occlusion / contact shadows | off / off | 0.85 / 0.8 | off / off | off / off |
| Sun shadow edge (radius) | 3 | 6 (softer) | 3 | 3 |
| Models | base | fine (detail pass) | base | base |

Outline classes: every mesh that should get a line calls `inked(mesh, cls)` with `'figure'` (caretaker,
animals), `'building'` (kit parts, scaffolding, lanterns, fences, bench) or `'nature'` (trees, rocks,
grass-level props; the default). Decor kinds declare theirs as `ink` in `decor-models.ts`. Flat ground
pieces (`flat: true`: raked gravel, stepping stones) never get lines or shadows.

## Painted+ (owner request, 2026-11-10)
The owner asked to move "a bit" toward a soft-lit diorama (in the direction of games like Tiny Glade, not a
copy of one): Painted's warmth and brushwork stay; light, grounding and detail improve. All of it is switched
on by the look (`light` and `detail` in `src/data/looks.ts`) and costs nothing in the other looks.
- **Baked occlusion** (`src/render/ao.ts`, called from `MB.build(ao)`): when a model is built, its surfaces
  are marked in a coarse voxel grid (~44 cells along its longest side) and every corner sends 12 short rays
  over its hemisphere; hits on the model, on `occluders` or below the ground plane (`ground: true`,
  `groundY`) darken its vertex color, warm (blue falls off faster than red). No per-frame cost. Pass
  `{ ground: true }` for models whose origin sits on the terrain, `occluders` for neighbours (a kit part is
  shaded by the parts built before it; a trunk by its crown), `{ off: true }` for glowing pieces.
  Cost: about 0.25 s more model building on a desktop at load (estimate ~1 s on a mid phone, not measured).
- **Contact shadows** (`src/render/contact.ts`): soft footprints of decor, gather nodes and build sites are
  painted once into a 4 px/m ground texture that the terrain shader reads (red = props and nodes; green =
  sites, scaled live by how far the deck has settled). The caretaker and the deer carry a soft blob.
- **Detail pass** (`look().detail === 'fine'`, `fine()` in `src/render/look.ts`): rounded stones
  (`stone()` in `decor-models.ts`: smooth-welded, ico detail 3), leaf crowns as one lumpy mass with a couple of
  softer clumps on top (`leafCluster()`), branches reaching into oak and cherry crowns, a finer stone lantern
  (stepped hexagonal base, turned post, firebox posts, curved cap with upturned corners, jewel finial, moss),
  stones around the pond's shoreline (`Stage.buildPondEdge`), rounder path stones, and the temple shelter with
  capped footings, a deck fascia, varied planks, post bearing blocks, a roof of tile courses, rafter ends,
  barge boards and a rounded ridge. The timber kit gets the occlusion and shadows but no new parts yet.
- `MB` parts accept `smooth: true` (weld corners, smooth normals) for rounded shapes.
- Geometry caches (`decorGeo`, `partGeo`, node geometry) are keyed by look.

## Lanternfall+ (owner request, 2026-11-10)
The owner likes Lanternfall-like best, for four reasons: crisp light and shadow bands, dark ink lines on
everything, richer color and contrast, and no grain or haze. Lanternfall+ keeps all of Lanternfall-like's
values (shading, outline, color remap, ground, haze, post) and adds Painted+'s `light` (baked occlusion
0.75, contact shadows 0.7, sun shadow radius 4) and the **rich** detail level (`detail: 'rich'`,
`rich()` in `src/render/look.ts`), which the owner asked for with phones set aside for now (PC first):
1. **Leafy crowns** (`leafyCrown()` in `decor-models.ts`): Lanternfall's clean round puff with small leaf
   clumps set into its surface, mostly over the top and sides, so the inked outline breaks into leaves.
   Trunks get flaring **roots** (`roots()`), branches get a forking twig. Gather trees use the same crown.
2. **Inked surface marks**: `MB` parts carry an `aMark` attribute (`setMark()` or `mark` per part: `wood`,
   `bark`, `stone`; the long axis of the part is the grain direction). `Mats.std` draws wood grain, coarser
   bark grain and stone cracks (3D cell edges, shown in patches) as fine dark lines in the shader
   (`MARK_GLSL` in `materials.ts`); lines fade where they would crowd. Code 1 = no marks, so geometry
   without the attribute is unmarked.
3. **Ground dressing** (`src/render/rich.ts`, `dressingPlan` + `dressingGeos`): edging stones along both
   sides of the path (gaps now and then), pebbles, moss patches at the feet of rocks and trees, petals under
   the cherries (floating on the pond too), clover and flower clumps, twigs under leafy trees. Kept clear of
   build sites. Instanced.
4. **Pond** (`RICH_WATER_GLSL` in `stage.ts`): the grassy bank softly mirrored near the shore, inked ripple
   rings spreading slowly from five spots, an inked line where water meets ground, and three koi gliding
   just under the surface (drawn after the water, slightly see-through). Not a true reflection of the scene.
5. **Life** (`Life` in `rich.ts`): 16 butterflies by day, leaves and petals drifting down from the crowns
   and settling, lotus and lily pads riding a slow swell, and the shelter's paper lantern swaying on its
   cord (`PartGeo.swing`, animated in `BuildingView`).
6. **Lantern light** (`LAMP_GLSL`, `shared.uLamps`, 8 slots): stone lanterns and the shelter's hanging
   lantern (once its part has settled) light the ground and things near them in two crisp rings at dusk
   and night, fading in with the lanterns' glow.
Cost: about 4× Lanternfall-like's vertices in decor and kits (an oak: 3.5k → 42k), ~0.6 s more model
building at load on a desktop, and heavier pixel shading on stone (the crack pattern). Not measured on a
phone; the owner set phones aside for this pass. Software rendering in the container is now very slow
(screenshots need a long timeout).

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
| A6 | Shading family | **Decided: Lanternfall+** (owner, 2026-11-10) |
| A7 | Seasonal palettes | Phase 5 gate |

## External assets
None. Fonts are system fonts; all sound is synthesized. Log the source and license of any future asset here.
