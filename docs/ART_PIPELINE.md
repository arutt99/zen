# Art pipeline

The rules for building and tuning art. **The look is decided: Lanternfall+** (A6, owner, 2026-11-10; plan
7.1): crisp three-tone bands, ink outlines on everything, rich color, no grain or haze, baked occlusion and
contact shadows, and the rich detail level. New models are built and judged in Lanternfall+ (`?look=lanternfallplus`)
on a PC first, with the chibi caretaker (A4) and timber buildings (A5). The unpicked looks (Painted, Painted+,
Woodblock) and the storybook proportions were removed at the start of Phase 3; plain **Lanternfall** stays as the
light look the smoke test drives (`?look=lanternfall`). Temple stays as a future per-building style (Phase 5,
`?trial` shows the kit switch).
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

## Look presets (plan 7.4)
All style values live in `src/data/looks.ts`; the active look is chosen per page load (`src/render/look.ts`,
or `?look=lanternfallplus|lanternfall` in the address). Shaders are generated for one look, so switching reloads.

| Setting | Lanternfall+ (decided, A6) | Lanternfall (light fallback) |
|---|---|---|
| Tone levels (shadow, mid, lit) / step softness | 0.6, 0.9, 1.22 / 0.03 (hard) | same |
| Shadow tint | cool (0.8, 0.82, 1.08) | same |
| Brush / rim | 0.42 / 0.4 | same |
| Outlines | near-black, 1.9/720, everything | same |
| Ground | crisp patches, inked path edge | same |
| Haze, grain, posterize | none | none |
| Bloom (strength, radius, threshold) / vignette | 0.24, 0.5, 1.2 / 0.32 | same |
| Baked occlusion / contact shadows / sun shadow radius | 0.75 / 0.7 / 4 | off / off / 3 |
| Models | rich (detail pass + inked marks, dressing, life, lantern light) | base |

Outline classes: every mesh that should get a line calls `inked(mesh, cls)` with `'figure'` (caretaker,
animals), `'building'` (kit parts, scaffolding, lanterns, fences, bench) or `'nature'` (trees, rocks,
grass-level props; the default). Decor kinds declare theirs as `ink` in `decor-models.ts`. Flat ground
pieces (`flat: true`: raked gravel, stepping stones) never get lines or shadows.

## Grounding and detail (from the Painted+ trial; now part of Lanternfall+)
The Painted+ trial (owner request, 2026-11-10) introduced the baked occlusion, contact shadows and detail pass
that Lanternfall+ kept. The look itself is gone; the techniques below are what remain.

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

## Characters (A4, Phase 2)
Proportions in `src/data/characters.ts`: chibi (A4), 1.8 m to the top of the bun (A3; a data check holds
it within 8 cm). The caretaker (`src/render/caretaker.ts`): cream top with a crossed collar and basket
straps, brown hakama legs that swing from the hip, sandals, wide sleeves, a hair cap with bangs, side locks
and a bun with a tie, and a dot-and-line face with blush (the face has no outline). The wicker basket is
six alternating bands with ribs and a rim; sticks and pebbles fill it item by item.
The deer (`src/render/deer.ts`) follows the caretaker's style: big head, short legs. It wanders by
`src/sim/animals.ts` and drifts closer (on its own side) while the caretaker sits.

## Building kit library (A5, Phase 2)
`src/render/kits.ts` holds parts every building is assembled from: `floor` (footings + planks or logs),
`post`, `beam`, `screen` (shoji or woven reeds), `roof` (rows of grey tiles with a ridge, or layered thatch
with crossed ridge poles), `lantern` (glowing paper), `noren`, and per-style scaffolding. Two styles:
**temple** (the reference) and **timber** (rustic). A building's part ids are the same in every style, so
cost and build order never depend on it. A part may return a `glow` piece (drawn with `Mats.glow`).

## Phase 3: the home valley's buildings
- **Timber detail pass (roofs first)**, Lanternfall+ only (`fine()`): `thatchSide()` lays rafter poles and
  purlins under each slope, then five staggered courses of straw bundles (squashed rolls laid down the slope,
  each course a little prouder than the one above, with a thin binding rod), and a ragged eave of uneven straw
  ends over a darker cut. `thatchRidge()` is a thick bound roll with rope ties, pairs of crossed poles lashed at
  the crossing, a rider pole and a little moss. `timberFloor()` stands close-laid logs with pale cut ends on
  sleepers, with lashed edge poles. Posts carry bark marks.
- **Kits** (`src/render/kits.ts`): `garden_kit` (4.4 × 3.0 m raked bed, three mossy stones, log borders, edging
  stones, a bench, a rake; two raked patterns as `patterns`), `hall_kit` (5.2 × 4.0 m on a stone plinth, six
  posts, three woven walls, an open front, a deep roof in two slopes plus a ridge, a hanging lantern, steps,
  stepping slabs and two stone lanterns), `tower_kit` (a 2 m square of posts on a log sill over paving, braces,
  a bell beam with a bronze bell and a hanging log striker that swing when rung, a small roof, a water basin and
  a stone lantern). New helpers: `screenAlong` (walls in any direction), `stoneRow`, `floorHalf`, `slab`,
  `stoneLanternPart`; `roof()` can build one slope or only the ridge (so a roof can arrive in several parts).
- **Mixed materials**: every part rests on the ground or on an earlier part of its own material (`on` in the
  building data). Stone builds plinths, paving, steps, edging and lanterns; wood frames stand on their own sills
  and stilts, so any mix of deliveries looks whole.
- `PartGeo` grew `lights` (lanterns standing on a part), `swing` without glow (`heavy` for the bell), and
  `patterns`. `MB.place()` adds a copy of a built model (e.g. a decor stone lantern) as one part.
- **Contact shadows per site**: each site's footprint is painted at its own strength as its deck settles
  (`Stage.setSiteShades`), so an unbuilt site never shows a shadow.

## Restoration layer (Phase 3, plan 3.4)
Props listed in a place's `growth` data grow in once restoration reaches `min` and wither away once it
reaches `max` (`src/render/growth.ts`, instanced per kind; ~2.6 s to grow, ~3.4 s to wither, with a slight
overshoot and twist; never solid). Overgrowth: `bramble`, `tall_weeds`. New growth: `flower_bed`, `iris`,
`path_lantern` (the paper glows only once lit by the ritual), a young `cherry`, and the trail gate
(`trail_gate_shut` → `trail_gate_open`). Poem stones (`poem_stone`) and note posts (`note_post`) use the same
layer. Shader-side: `uMurk` in the water (a dull green-brown film that clears by the gravel garden) and `uHeal`
in the terrain (patches of tired, browner ground that green up as restoration rises).
The old timber gate at the valley's mouth (`old_gate`) is a static prop you walk through.
Lantern light (Lanternfall+): the 8 light slots go to the lanterns nearest the caretaker each frame.

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

## Phase 4 models (the first journey)
All built in code on decided art (A1–A6), timber style, Lanternfall+ first.
- **Bamboo** (`src/render/kits.ts` helpers `culm`, `pole`, `bambooScreen`, `bambooFence`, `bambooRoof`): a culm is
  a green two-tone cylinder (`#7A9048`→`#B8C070`) with a darker node ring (`#5F7238`) every ~0.45 m and a pale
  cut top; poles are lashed with near-black cord (`#2A2420`); a split-bamboo roof lays halved culms down the
  slope, alternating light and dark. Bamboo is the same in every kit style.
- **Bamboo gather clump** (`BambooView`, `src/render/nodes.ts`): 4 culms (4.6 m, one per unit) with leaf tufts
  near the top over a mat of leaf litter; each cut shrinks one culm into its slanted stub (no falling); shoots
  rise back one at a time. Ground ring as for trees and boulders.
- **Wind shrine** (`shrine_kit`): stone platform 2.2 × 1.8 m (two halves) with a step and a basin, four
  planted bamboo posts, a split-bamboo roof with a ridge pole, and wind chimes under the front eave that sway
  (`PartGeo.swing`). No deity imagery (plan pillar 4); a flat stone beside the basin for a flower.
- **Tea house** (`teahouse_kit`): a timber log floor 2.6 × 2.2 m, four log posts and a thatched roof (the timber
  helpers), with bamboo walls planted around it, a fenced garden, a bamboo bench with a tea set (bowl, whisk,
  scoop, ladle; `PartGeo.steam` marks where steam rises) and a water pipe (`PartGeo.rocker`, animated in
  `BuildingView.updateRocker`: fills ~6 s, tips, pours, knocks back; the knock calls `onTock`).
- **Crane** (`src/render/crane.ts`): chibi like the deer, ~1.2 m to the crown: white body, grey folded wings,
  black tail plumes and throat, red crown, pale bill, long dark legs. Walks high-stepping, dips its bill to
  the water, and rests on one leg.
- **Decor** (`decor-models.ts`): `map_board` (the painted travel map under a little thatched roof),
  `fence_bamboo` (2 m), `fallen_bamboo` (dry culms and dead leaves: grove overgrowth), `fern` (wind-swayed).
- **Travel map** (`public/index.html`, `#travel`): a painted sheet in SVG (washes of green for hills, a river,
  the dotted trail between known places), places as pins with names; the current place is red. HTML, so it
  stays crisp at any size; buttons are at least 48 px.

## Palette
Bamboo grove (Phase 4): the home presets with a cooler, deeper floor (`#4F7F42`/`#6F9A52`/`#9FB06A`), bamboo-
tinted grass, a green-gold haze by day and darker, clearer spring water (`groveOf` in `src/data/presets.ts`).
This is a place palette, not a seasonal one (A7 is untouched).

Home valley, spring day: `src/data/presets.ts` (`home_day`), Lanternfall's meadow nudged toward the plan's
palette (plan 7.2). Path `#D9C39D`/`#A48A62`, water `#9CC7B8`→`#3F7F7A`, cherry blossom `#D98AA0`→`#F6D2DC`.

## Art decision points (plan 7.4)
| # | Decision | Status |
|---|---|---|
| A1 | 2D vs 3D | **Decided: 3D** (owner, 2026-11-10) |
| A2 | Camera angle, height, zoom | **Decided: camera A, Classic ~40°** (owner, 2026-11-10). Options B and C are recorded in `docs/phase1/README.md`. Trees can still hide the caretaker (Phase 2: fade canopies in between) |
| A3 | World scale and spacing | **Decided: Medium caretaker, 1.8 m** (owner, 2026-11-10). Trees and spacing unchanged |
| A4 | Character proportions | **Decided: chibi** (owner, 2026-11-10) |
| A5 | Building kit style | **Decided: timber by default**, temple and others as a free per-building style later (Phase 5); timber detail pass (roofs first) done at the start of Phase 3 (owner, 2026-11-10) |
| A6 | Shading family | **Decided: Lanternfall+** (owner, 2026-11-10) |
| A7 | Seasonal palettes | Phase 5 gate (Phases 3 and 4 built nothing seasonal; the grove's palette is a place palette) |

## External assets
None. Fonts are system fonts; all sound is synthesized. Log the source and license of any future asset here.
