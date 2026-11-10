# Phase 2 gate: art decision points A4 (characters), A5 (building kit), A6 (shading family)

> **Not decided yet.** Everything below can be switched live in the game: ☰ → *Art trial (Phase 2)*.
> Look reloads the page (a second or two); caretaker, kit and time switch at once. Your progress is kept.
> On a computer you can also add `?look=painted`, `?look=paintedplus`, `?look=lanternfall` or `?look=woodblock`
> to the address.

Screenshots: phone landscape (844 × 390, 2× pixels), rendered with **software graphics in a container**
(Low quality tier, no anti-aliasing), not on a phone. Colors and shapes are right; edges are rougher and grass
sparser than on your phone. Recreate them with `npm run build && node scripts/shots.cjs docs/phase2`.

## A6: Shading family (the look)

| | Day | Dusk | Pond |
|---|---|---|---|
| **Painted** (the reference) | ![](look-painted-day.jpg) | ![](look-painted-dusk.jpg) | ![](look-painted-pond.jpg) |
| **Painted+** (new, see below) | ![](look-paintedplus-day.jpg) | ![](look-paintedplus-dusk.jpg) | ![](look-paintedplus-pond.jpg) |
| **Lanternfall-like** | ![](look-lanternfall-day.jpg) | ![](look-lanternfall-dusk.jpg) | ![](look-lanternfall-pond.jpg) |
| **Woodblock print** (wildcard) | ![](look-woodblock-day.jpg) | ![](look-woodblock-dusk.jpg) | ![](look-woodblock-pond.jpg) |

- **Painted** applies the plan 7.1 checklist: wide, blended tone steps; warm, light shadows; stronger brush
  texture; thin warm-brown lines on the caretaker, deer and buildings only (none on trees, rocks or ground);
  a warmer, less saturated grade; paper grain; more distance haze; a lighter, warmer palette.
- **Lanternfall-like** is the Phase 0/1 look, unchanged: hard three-tone cel bands and near-black lines on everything.
- **Woodblock print** is the wildcard: two flat tones, fine dark-brown lines on everything, a limited palette
  (posterized) on textured paper.

### Painted+: Painted, a step toward a soft-lit diorama (added 2026-11-10)

You asked to move "a bit" in the direction of a soft-lit diorama (games like Tiny Glade), not all the way.
Painted+ keeps Painted's warm palette, paper and brushwork and changes three things:

1. **Light that grounds things:** soft, warm shading where parts meet each other and the ground (baked into
   every model when it's built, so it costs nothing per frame), soft contact shadows on the ground under
   props, trees, the shelter and the caretaker and deer, and softer sun-shadow edges.
2. **Lighter linework:** thin lines on the caretaker and deer only; buildings and nature read as solid objects.
3. **Detail where you look:** rounded stones, tree crowns as a few soft leaf masses with branches reaching in,
   stones around the pond's edge, a finer stone lantern, and a temple shelter with tile courses, rafter ends,
   capped footings and varied planks. (The rustic timber kit gets the light but not the new detail yet.)

| | Painted | Painted+ |
|---|---|---|
| Valley | ![](plus-painted-wide.jpg) | ![](plus-paintedplus-wide.jpg) |
| Close | ![](plus-painted-close.jpg) | ![](plus-paintedplus-close.jpg) |
| Shelter (temple) | ![](plus-painted-kit.jpg) | ![](plus-paintedplus-kit.jpg) |
| Half built | ![](plus-painted-kit-partial.jpg) | ![](plus-paintedplus-kit-partial.jpg) |
| Golden hour | ![](plus-painted-golden.jpg) | ![](plus-paintedplus-golden.jpg) |

**To check on your phone:** frame rate on Medium (bottom-left), and how long the first load takes. The detail
pass roughly doubles the vertices in trees and the shelter, and building the models takes a little longer
(about 0.25 s more on a desktop; not yet measured on a phone).

**What it decides:** picking Painted+ for A6 also sets the detail level that every later model is built to,
so Phase 3's buildings would get the same treatment (more model work per building, but done by the agent).

Time of day comes with every look: dawn, day, golden hour, dusk and night, blended from your clock
(☰ → Time → *Follow my clock*, or *Choose* and drag the slider):

| Dawn | Golden hour | Night |
|---|---|---|
| ![](time-painted-dawn.jpg) | ![](time-painted-golden.jpg) | ![](time-painted-night.jpg) |

**Why it gets expensive later:** every model's colors, line thickness and shading are tuned against one look.
Once Phase 3 builds the hall, the bell tower and the rest of the valley, switching means re-tuning all of
them (and the seasonal palettes of Phase 5 are built on top).

## A4: Character proportions

| Chibi (like the reference) | Storybook (taller) |
|---|---|
| ![](caretaker-chibi.jpg) | ![](caretaker-storybook.jpg) |
| ![](caretaker-chibi-lanternfall.jpg) | ![](caretaker-storybook-lanternfall.jpg) |
| Big head, about 2.5 heads tall, short limbs. Reads instantly at phone size; the face is visible from the play camera. | About 4 heads tall, slimmer, longer limbs; feels older and calmer. The face is small at play distance. |

Both are 1.8 m to the top of the bun (A3 stays valid). The deer follows the same style (chibi: big head,
short legs; storybook: natural). Close-ups use a debug camera; in play the caretaker is the size of the
other screenshots.

**Why it gets expensive later:** the walk and work animation, the basket, the deer, later animals and the
quiet residents are all built on these proportions.

## A5: Building kit style (and how a half-built building looks)

| | Half built (4 of 6) | Finished | Finished, at night |
|---|---|---|---|
| **Temple** (like the reference) | ![](kit-temple-partial.jpg) | ![](kit-temple-done.jpg) | ![](kit-temple-night.jpg) |
| **Rustic timber** | ![](kit-timber-partial.jpg) | ![](kit-timber-done.jpg) | ![](kit-timber-night.jpg) |

- **Temple:** square cedar posts on stone footings, raised plank floor with stone steps, shoji screen, grey
  tiled roof with a ridge, a paper lantern that glows at night, a noren curtain with a lotus. Squared-timber
  scaffolding with a ladder and walkway.
- **Rustic timber:** round log posts lashed with rope, a floor of logs on field stones, a woven reed screen,
  a thick thatched roof with a straw fringe and crossed ridge poles, diagonal braces. Lashed-pole scaffolding.

In both, missing parts show as a pale ghost and scaffolding stands until the last part settles. Part ids are
the same in both styles, so cost and build order never change.

**Why it gets expensive later:** every building (shelter, gravel garden, hall, bell tower, tea house) and every
half-built state is assembled from this kit. After Phase 3 builds four more buildings in one style, switching
means remodelling all of them.

## Also new in Phase 2 (no decision needed)

- The Zen kit around the home valley: stone lanterns, stepping stones to the bench, lotus in the pond,
  mossy stones, a raked gravel circle, wooden and rope fences, maples and bamboo. Placed for review; Phase 3
  lays out the valley properly.
- Trees in front of the caretaker thin out (a dithered see-through) so they never hide them.
- Gatherable trees and boulders show a soft ring on the ground as you approach.
- The deer walks in once the shelter is finished, grazes, rests, and steps aside if you walk right up to it.

## Recommendation

- **A6: Painted.** It is the closest to the reference image: soft light, warm shadows, brown lines only where
  the reference has them. Woodblock is striking and worth a look, but it moves away from the reference's
  softness; Lanternfall-like is the look we set out to leave. If Painted feels too washed out on your phone,
  tell me which part (ground, trees, shadows, lines) and I'll tune it before locking.
- **A4: Chibi.** It matches the reference, and at play distance the face and the basket still read on a phone.
- **A5: Temple.** It matches the reference's hall (tiled roof, noren, paper lanterns) and gives the later hall
  and bell tower a coherent vocabulary. Rustic timber could still appear as one humbler building (a woodshed)
  without changing the kit.

Please try them on your phone, by day and at night, and tell me your three picks. After that I record the
final values in `docs/ART_PIPELINE.md` and remove the options you didn't pick.
