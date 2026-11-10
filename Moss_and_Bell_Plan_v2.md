# Moss & Bell: Game Plan v2

**Status:** Replaces `Moss_and_Bell_Detailed_Build_Plan.md` as the working plan. The v1 file stays for reference.
**Built by:** an AI coding agent (Codex, Claude Code or similar) as engineer; the owner as director and tastemaker.
**Kind of project:** personal passion project. No commercial pressure, no monetization.
**Tech:** TypeScript + three.js + esbuild, starting from the engine of **Lanternfall** (the owner's own game in `arutt99/eGiAdMfElS/games/lanternfall`). Ships as one offline HTML file that can be installed as a web app.
**Platforms:** phone and PC as equals from the first playable build, both in the browser. App-store builds are optional later.

---

## 1. The vision in one paragraph

You arrive at an overgrown mountain valley with an empty satchel. Walk up to a tree or a mossy boulder and the caretaker starts chopping or chipping on their own, in a calm, steady rhythm, and you watch the tree thin out swing by swing. Walk to a marked foundation and what you carry flows into it piece by piece, so you watch a hall rise beam by beam. As the home monastery grows, the valley heals: mist thins, flowers spread, animals arrive. Then you follow a trail out of the valley to new places, like a bamboo grove, a riverbank or a mountain pass. Each has its own small shrine to restore and a new material to bring home. The world follows your real clock and calendar. At any point you can sit on a bench, let the interface fade away and just watch the place live. The game has no ending; it's a place you keep going back to.

## 2. What the game is about

Everything in this plan serves these three things. If a feature serves none of them, cut it.

| Hook | What it means in play | How we know it works |
|---|---|---|
| **Watching it grow** | Every deposit visibly adds to a building. Every finished building visibly heals the land around it. Before and after are striking. | A playtester stops to look at what they just made. |
| **The gathering rhythm** | Gathering is automatic, steady and musical: a soft beat with pentatonic tones, so a run of gathers makes a little melody. "Just one more tree." | A playtester keeps gathering past what they need. |
| **Stillness** | Sit anywhere marked and the camera pulls back while the HUD fades. Light, weather, animals and seasons carry the moment. No reward is attached. | A playtester sits for more than 30 seconds of their own accord. |

**Taken from the inspiration (My Little Universe), in our own form:** an expanding world, and controls with no friction (one thumb, auto-gather, auto-deposit).

**Deliberately left out:** stat upgrades, making the character faster or stronger, helpers who gather for you, numbers that keep climbing, timers, energy, streaks, punishment for being away.

### Design pillars
1. **Presence over pressure.** No fail states, deadlines, withering crops or "you were away" penalties.
2. **Effortless hands.** The whole core loop works with one movement input and no buttons.
3. **Growth you can see.** Progress is shown in the world, not in a menu.
6. **Nothing jumps from 0 to 100%.** Every action moves the world a little at a time, and you see each step: a tree thins with every swing, a building gains a piece with every unit delivered. Half-done is a real, visible state that stays where you left it (owner decision, 2026-11-10).
4. **Respect for Zen.** A fictional, Zen-inspired place. No enlightenment meter, no spiritual currency, no caricature of real practice. Everyday work is shown as care.
5. **Light words.** The place tells its own story. Words are rare and therefore valued: poems, notes from earlier caretakers, a signpost.

### Non-goals (for everything in this plan)
Combat, dialogue trees, quests and quest logs, crafting trees, a shop or currency, multiplayer, procedural generation, accounts or servers, monetization, and stat upgrades.

---

## 3. The core loop

**Gather → carry → deposit → watch it grow → the land responds → explore further.**
One cycle takes 30–90 seconds. A building takes 1–4 cycles.

### 3.1 Gathering (automatic, animated, gradual)
- Gather nodes: trees (wood), mossy boulders (stone) and, in later places, bamboo, clay and others. A tree holds a few units (default 5), a boulder a few more (default 4–6).
- Walk into a node's gather radius and the caretaker turns to it and starts working with a visible animation (an axe swing for trees, a chisel tap for stone), taking **one unit per beat** (default beat 0.55 s). Walking away stops at once, and every beat's unit has already been awarded. There is no "reward on completion" state to get wrong.
- **The node visibly depletes with every unit.** A tree loses leaves and branches, its canopy shrinks and notches appear in the trunk, until only a stump is left. A boulder is chipped smaller piece by piece. Each step animates smoothly (falling leaves, wood chips, stone dust) instead of popping. A half-chopped tree stays half-chopped while you are away from it.
- Each beat plays one note from a pentatonic scale, rising through the node's units. A small particle and a basket bump confirm the gather.
- An empty node rests, then regrows gradually (default 20–40 s): a sapling rises from the stump and fills out, a boulder gathers moss and grows back. There are always enough nodes nearby that the player never has to wait.
- Felling is gentle: trees thin out to a stump and grow back; no crashing trees or shattering rock (owner decision, 2026-11-10, replacing "collect only fallen material").

### 3.2 Carrying
- The satchel holds a modest amount of each material (default 20) and visibly fills. The gentle cap is what creates the walk between gathering and building, which is part of the rhythm. Capacity never upgrades.
- A small HUD chip shows what you carry. It hides when the satchel is empty.

### 3.3 Building (automatic deposit, visible growth)
- A build site is a soft-edged ground marker with a ghost outline of the structure. Standing on it shows the cost as icons with how many are still needed.
- While the player stands on the site, materials flow from the satchel into it **one per beat**, with an arc of the item and a soft wooden or stone note.
- **The building grows one piece per unit delivered.** Each building is an ordered list of parts (foundation stones → posts → beams → walls → roof tiles → details), one part per unit of cost, so a 24-unit hall grows in 24 visible steps. Each part animates into place. If you run out of materials partway, the building stays visibly incomplete (gaps in the walls, an open roof, scaffolding) until you bring more. Partial progress is saved and stays forever (owner decision, 2026-11-10, replacing 4–6 stages).
- On completion: a bell, a dust and petal burst, and a short camera ease-out that shows the land responding (see 3.4). Then the next site gently reveals itself.
- Sites are authored, fixed locations. Free placement is only for decorations (Phase 5).

### 3.4 The land responds (restoration)
- Every place has a restoration level from 0 to 1, driven by what has been built there.
- As it rises, overgrowth recedes, mist thins, paths clear, flowers and grass spread, lanterns appear, and water clears.
- Implementation: props tagged with a `min_restoration` or `max_restoration` value fade in or out, plus a shader parameter for ground tint and grass density. Data-driven, not hand-scripted per building.

### 3.5 Stillness and rituals (optional, never required)
- **Sit and watch:** marked benches and stones. Sitting fades the HUD, eases the camera out and up, slowly lifts the ambient sound, and makes animals approach more often. Any input stands up.
- **Rituals:** ring the bell, rake the gravel garden, light lanterns at dusk, sweep fallen leaves. Short, satisfying, unrewarded. Rituals that fit the time of day appear on their own (lanterns at dusk, leaves in autumn).
- **Poem stones:** hidden in the world. Walking up to one shows a short original poem and adds it to the collection book.

---

## 4. The world: a home and journeys

### 4.1 Structure
- **The home valley** is where the main monastery grows. It's the biggest place and the one you return to most.
- **Journeys** lead out along trails to distinct places. Each place has:
  - one **new material** that unlocks new building types at home,
  - one **small shrine** to restore on site, which links back to home: it unlocks a home building or decoration set and adds to the travel map,
  - its own animals, poem stones, sit spots and seasonal details.
- **Travel:** the first visit to a place means **walking the trail**, which is the discovery. After that, the place appears on a **painted travel map** at the home gate, and at each shrine, for instant travel. Walked trails stay walkable for anyone who enjoys the walk.

### 4.2 Planned places (data-driven, added one at a time)
| # | Place | New material | Shrine | Animal friend | Unlocks at home |
|---|---|---|---|---|---|
| 0 | Home valley | wood, stone | none (the monastery is here) | deer at the pond | shelter, gravel garden, meditation hall, bell tower |
| 1 | Bamboo grove (first slice) | bamboo | wind shrine | crane | tea house, bamboo fence decor, water pipe (*shishi-odoshi*-style) |
| 2 | Riverbank | clay | stepping-stone shrine | koi | roof tiles (upgrades hall visuals), pottery decor |
| 3 | Mountain pass | slate | cairn shrine | mountain goat | lookout pavilion, stone lanterns |
| 4+ | Later journeys | e.g. pine resin, moss | … | … | … |

Only places 0 and 1 are in the first complete version. The others show the pattern, and each one is a later phase of its own.

### 4.3 Animals now, quiet residents later
- **Animal friends** arrive because of what you build (a pond brings the deer; the wind shrine brings the crane). They wander, rest near you when you sit, and appear in the collection book. No feeding, no needs, no taming.
- **Quiet residents** come later. Once the home monastery reaches a set size, a few figures can arrive and go about life (sweeping, sitting, tending) as ambience, with at most a line or two. Keep them out of the first complete version, but make room for them: residents reuse the animal wander, rest and sit behaviour.

### 4.4 Words
- Opening: one line on screen at the start (e.g. *"A quiet place can begin with one small act."*) and no tutorial text. The first build site's ghost outline and the nearby branches teach the loop.
- **Notes from earlier caretakers:** a handful per place, a sentence or two each, giving the valley a history without a plot.
- **Poems:** original short verse. The agent writes placeholders marked `PLACEHOLDER`; the owner writes or approves the final text. Never use published translations of classic haiku: translations are often still under copyright.

---

## 5. Time and seasons (real-world clock)

- **Time of day** follows the device's local clock: dawn, day, golden hour, dusk and night lighting, interpolated smoothly. Night is beautiful, not dark: moonlight, lanterns, fireflies.
- **Seasons** follow the calendar. The hemisphere is a setting (Northern by default). Each season has a palette, ground cover (petals, green, maple leaves, snow) and a few seasonal details or findables.
- **Settings:** "Time: follow my clock / always day / choose" and "Season: follow calendar / choose". People who only play late at night, or who want to see autumn in April, can.
- **Absence never costs anything.** Coming back after time away shows gentle changes: leaves to sweep, a visiting animal, a new season. No streaks, no daily rewards.
- **Collections stay fair.** Seasonal findables are a nice extra and never block progress. "Choose season" makes them all reachable.
- Engineering: one clock module (`core/clock.ts`) supplies `time_of_day (0–1)` and `season`. Everything else reads from it, and a debug override lets you test any moment.

---

## 6. Controls and platforms

| Action | Phone | PC |
|---|---|---|
| Move | Floating joystick anywhere on the left 60% of the screen | WASD / arrows / left stick |
| Gather, deposit | Automatic | Automatic |
| Context action (sit, ring the bell, read a poem, open the map) | One large contextual button that appears only when useful | E / Space / gamepad A |
| Menu | Small corner button | Esc / Start |
| Camera zoom | Pinch (two presets) | Mouse wheel / bumpers |

- Landscape on both, with a "turn sideways" screen on phones held upright (as Lanternfall does). Safe-area aware.
- Touch targets at least 48 px. Nothing depends on hover or right-click. Reuse Lanternfall's touch handling and its "last input was a finger" switch for prompt wording.
- **Every phase gate is checked in a real phone browser (iPhone Safari and/or Android Chrome) and on PC.**
- Installable as a web app (manifest and icon, like Lanternfall) and playable offline from the single built file. Wrapping it for the app stores (e.g. with Capacitor) is a later, optional step.
- Performance: reuse Lanternfall's quality tiers (Low to Ultra: pixel ratio, shadows, grass count, particles, painterly pass), with the default picked by device. Target a steady 60 fps on PC and a mid-range phone on Medium.

---

## 7. Art direction

### 7.1 Current direction (not final): **the painted storybook reference is the target; Lanternfall's engine is the toolkit.**

> The owner is not yet sure about the art direction ("I'll know it when I see it"). Treat this as the leading candidate, keep the look easy to change, and follow the art decision points in 7.4.
The target look is the owner's reference image, `docs/art-reference.jpg`: a soft, hand-painted storybook Japanese garden. **It is not Lanternfall's look.** Lanternfall supplies the technology (painterly materials, procedural models, post-processing, phone performance), and those tools are retuned toward the reference. The two games should look related at most, never the same.

**The reference image, described** (the image itself is `docs/art-reference.jpg`; open it before any art work):
- Warm afternoon light, low contrast, gentle and slightly desaturated colors. Nothing is deep or saturated.
- Visible brushwork everywhere: ground, stone, wood and foliage look painted (gouache or watercolor), with soft color variation inside each shape.
- Linework is soft, thin and **warm brown**, not black, and it is absent on distant or soft things such as foliage edges, ground and mist.
- A chibi caretaker: big head, dark hair in a bun, cream top, brown hakama-style trousers, sandals, and a woven wicker basket on the back. Simple dot-and-line face.
- A Japanese garden vocabulary: a cherry tree with pink blossom and falling petals, a stone lantern with warm glow, moss on rocks, raked gravel circles around a mossy stone, stepping stones on packed earth, a lotus pond with lily pads and a stone edge, low wooden and rope fences, and a wooden hall with a tiled roof, paper lanterns and a noren curtain with a lotus.
- Soft depth: the background goes hazy and lighter. Shadows are soft and warm, never black.

**Lanternfall vs. the target, so the agent knows what to change:**

| Lanternfall today | Moss & Bell target (the reference) |
|---|---|
| Deep, saturated greens and teal water | Warm, light, slightly desaturated greens; soft jade water |
| Dark ink outlines on everything | Thin warm-brown lines on characters and buildings only, or none; no outlines on foliage and ground |
| Hard three-tone cel bands | Softer shading: wider, blended tone steps with brush texture doing most of the work |
| Night, fireflies, the long dark | Warm daylight by default; night is one gentle mood of the real clock |
| Dense, chunky forest from high up | Open garden spaces, readable props, lots of room to walk |
| Purple fantasy mushrooms | Cherry blossom, moss, lotus, stone lanterns |
| Heroic fantasy proportions | Chibi caretaker and animals with big heads and soft round shapes |

**What carries over from Lanternfall unchanged:** the procedural model builders, brush texture and wind, the post-process chain (retuned), water and lily pads, particles, quality tiers, touch, save and audio.

**Retuning checklist for Phase 2:** raise brush texture strength; soften the tone ramp; change outline color to warm brown, thin it, and limit it to characters and buildings; warm the color grade and lower saturation; add a paper-grain overlay and gentle haze with distance; lighten shadows and tint them warm; a lighter, warmer palette.

### 7.2 Look and feel
- A living storybook, matching the reference image: warm, soft, painted, readable silhouettes. Readability at phone size beats detail.
- Starting palette for the home valley in spring daylight: moss `#779777`, fern `#A3B591`, cedar `#846B50`, light wood `#D9C39D`, warm paper `#F2E4C8`, stone `#9D9C8B`, soft jade water `#9CC7B8`→`#5E968E`, lantern `#F4C98A`, cherry `#E9A9B8`, plum `#8E6FA8`, roof slate `#5F6B6A`. These are tuned in the place's preset data, not hard-coded.
- The camera follows the caretaker with damping, high enough on a phone to see the satchel, nearby nodes and the build site together. Pinch or wheel zooms between two presets. No free rotation in the first version, unlike Lanternfall.
- An original caretaker built in code: small, round, loose robe, hair bun, and a **wicker basket on the back that visibly fills** with branches and stones. The basket is Moss & Bell's answer to "I'm carrying stuff".
- Use fewer ambient effects, done well: petals, water shimmer, lantern sway, mist, fireflies at night.
- **Distinct from the inspiration:** no stack of items on the character's back, no bright saturated toy palette, no copied UI shapes or terminology.

### 7.3 Asset reality
Like Lanternfall, **every model is built in code** (canopy blobs, trunks, pine tiers, building parts) and textures come from canvases. There are no model files to make, buy or license, which suits an AI agent: it can build and tune art directly, and the owner judges it on screen. `docs/ART_PIPELINE.md` records the style rules: scale (1 unit = 1 m), outline widths, the tone bands, the palette per place and season, poly budgets, and how to add a new procedural model. If any external file (a sound, a font) is ever added, its source and license go there too.

### 7.4 Exploring the look, and art decision points
The owner wants to see options before committing. So the look is built to be **tried and switched, not decided up front**:

- **Look presets.** Everything that defines the style lives in one data file of named presets (`src/data/looks.ts`): palette, outline color and width, which objects get outlines, tone ramp softness, brush strength, paper grain, haze, shadow tint, color grade, bloom, and character proportions. Lanternfall already switches between two looks this way (`render/style.ts`); extend that idea.
- **A look switcher** in the settings or debug menu changes presets live (or with a quick reload) on the phone, so the owner can compare in the real game. Keep at least three presets until the owner picks one: **Painted** (the reference), **Lanternfall-like**, and one wildcard the agent proposes.
- **Painted+** (added 2026-11-10 at the owner's request) is a fourth preset: Painted nudged a little toward a soft-lit diorama (baked occlusion, contact shadows, finer models). It is an option for A6, not a decision.
- **Screenshot sets.** At each art checkpoint, the agent captures the same views in every preset (phone size, day and dusk) and shows them side by side.

**Cheap to change at any time** (data and shader values, no rework): colors and palettes, outlines, shading softness, brush and paper texture, haze, color grade, lighting presets, particles.

**Expensive to change later** (cause rework if changed after the deadline). These are the **art decision points**:

| # | Decision | Why it's expensive later | Decide by |
|---|---|---|---|
| A1 | **2D vs 3D world.** | Every system that draws or places things depends on it | **Decided: 3D** (owner, 2026-11-10) |
| A2 | **Camera angle, height and zoom range** | Sets how big every model, path and build site must be, and what's readable on a phone | **Decided: camera A, Classic ~40°** (owner, 2026-11-10) |
| A3 | **World scale and spacing:** how big the caretaker is versus trees, buildings and walking space | Every place layout and the collision setup are built around it | **Decided: Medium caretaker, 1.8 m** (owner, 2026-11-10) |
| A4 | **Character proportions and style** (chibi vs taller, how faces are drawn) | All animation, the basket, animals and later residents follow it | Phase 2 gate |
| A5 | **Building kit style:** the part set buildings are assembled from (posts, beams, roofs) and how a partly built building looks | Every building and every partial state is made from it | Phase 2 gate |
| A6 | **Shading family:** painted-soft vs inked-cel vs another | Models are tuned against it; switching late means re-tuning every model | Phase 2 gate |
| A7 | **Final palette per season** | Many places and props get tuned to it; cheap per item, costly in total | Phase 5 gate |

**The agent's duty:** before a phase that would build on an undecided point, and again at the gate where it's due, the agent **stops and warns the owner in plain words**: which decision, the options with screenshots, what becomes expensive to change after this, and a recommendation. It never locks one of these silently, and never builds lots of content on an undecided point. Decisions are recorded in the table above (replace "Decide by" with the choice and the date).

---

## 8. Audio
- Buses: Master, Ambience, Effects, Music. Settings remember levels and mute.
- **Gathering tones:** each material has its own timbre (wood: soft marimba; stone: a ceramic tap; bamboo: hollow knock), all on one pentatonic scale, so any sequence sounds pleasant.
- Ambience layers change with time of day and season: birds and stream by day, crickets and wind at night, rain in summer, wind chimes in autumn.
- The bell is the signature sound: building completion, the ritual bell and dusk.
- Music is optional, sparse and easy to mute. Silence is a valid default.
- Every audio cue has a visual counterpart, so the game reads fully with sound muted.

---

## 9. Architecture

### 9.1 Start from Lanternfall's engine
Copy (don't link) these parts of `games/lanternfall` into the new project in Phase 0, then adapt them. Lanternfall stays untouched.

| Lanternfall file(s) | Reused for |
|---|---|
| `render/engine.ts` | Renderer, quality tiers, post-process chain (paint, bloom, grade), outline-free shadow pass, graphics context loss handling |
| `render/materials.ts`, `render/style.ts` | Painterly materials: brush texture, cel tones, rim light, wind, outline shells |
| `render/mb.ts`, `render/decor-models.ts` | Procedural mesh building: canopies, trunks, pines, rocks. Base for cherry, maple, bamboo and building parts |
| `render/stage.ts`, `render/biomes.ts` | Island terrain, water, grass, sky and fog. Biome presets become place + time-of-day + season presets |
| `render/vfx.ts` | Particles: petals, dust bursts, fireflies, gather sparkles |
| `render/hero-models.ts` | Starting point for the procedural caretaker and animals |
| `audio/synth-kit.ts`, `audio/audio.ts` | Synth sound and music with musical scales: gathering tones on a pentatonic scale, the bell, ambience |
| `core/save.ts`, `core/util.ts`, `ui/touch.ts` | Versioned save, seeded random, touch and input detection |
| `scripts/*.mjs`, `tsconfig.json`, `manifest.webmanifest` | Build to one HTML file, local server, test runner, installable web app |

Not reused: the tower-defense simulation, towers, enemies, spells, tech tree and battle UI.

### 9.2 Principles
- **Content is data.** Places, materials, buildings, stages, decorations, animals, poems and presets live in typed TypeScript data files under `src/data/` with stable string IDs, as Lanternfall's `data/` does. Balance numbers live only there. A validation step at boot (and in tests) reports bad data clearly.
- **Simulation apart from rendering.** As in Lanternfall, `src/sim` holds the game rules and runs headless with no three.js, so tests and bots use the real rules.
- **Store facts, derive the rest.** The save stores facts (materials delivered per site, places discovered, items found, decorations placed, settings). Restoration level, unlocked sites, map entries and animal presence are **derived from those facts on load**. That makes "an objective replays after reload" or "duplicate build" impossible by construction.
- **No timers in saved state.** Node depletion and regrowth are not saved; nodes start full on load. Building growth is derived from the units delivered (parts shown = units delivered), so the exact partial building comes back on load with no extra state.
- **Events over polling**; small modules; strict TypeScript.

### 9.3 Modules
| Module | Responsibility |
|---|---|
| `sim/state.ts` | Satchel contents, site deposits, discovered places, collection, decorations. The only place facts change. Emits events. |
| `sim/progress.ts` | Pure functions that derive restoration, unlocks and animal presence from state + data. Easy to unit test. |
| `sim/loop.ts` | The beat clock, gathering, depositing and node regrowth, driven by a movement input. Headless. |
| `sim/pacing-bot.ts` | A headless bot that walks the loop on each place map and reports cycle and building times, like Lanternfall's balance bot. It checks the 30–90 s cycle target automatically. |
| `core/clock.ts` | Real or overridden time of day and season. Debug override. |
| `core/save.ts` | Versioned JSON in `localStorage` with a migration hook per version and a safe fallback on corrupt data. Autosaves on every completed deposit batch, place change and when the page is hidden (important on phones). Asks the browser for persistent storage, and offers **export and import of the save as text** in Settings, because browsers can clear site data. |
| `render/*` | Lanternfall's engine plus place builders, the restoration layer, the time and season lighting blend, buildings that grow part by part, nodes that deplete and regrow visibly |
| `render/places/*.ts` | One builder per place: terrain shape, water, paths, prop layout, nodes, sites, sit spots, exits |
| `audio/*` | Buses, the beat-synced gathering and deposit notes, ambience layers, the bell |
| `ui/*` | HUD chip, context button, joystick, travel map, collection book, settings |

### 9.4 One proximity rule
The player has one sensor. Each frame it picks **one** target by priority: build site you're standing on > gather node in range > context interactable (sit, poem, bell, map). Gather nodes and build sites act automatically. Context interactables show the context button. Everything proximity-based implements one interface in `sim/proximity.ts`: `priority`, `radius`, `isAvailable()`, `onEnter()`, `onTick()` and `onExit()`.

### 9.5 Example definitions
```ts
// src/data/buildings.ts
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  meditation_hall: {
    name: 'Meditation Hall',
    place: 'home_valley',
    cost: { wood: 14, stone: 10 },
    requires: ['gravel_garden'],
    // One visible part per unit of cost, in build order: 24 parts here. The kit (plan 7.4, A5) supplies the models.
    parts: 'hall_kit',
    restoration: 0.3,
  },
  // ...
};
```
```json
{ "v": 1,
  "deposits": { "small_shelter": { "wood": 6 }, "meditation_hall": { "wood": 9, "stone": 2 } },
  "satchel": { "wood": 3 },
  "places": ["home_valley"],
  "collection": ["poem_first_light", "animal_deer"],
  "decorations": [],
  "at": { "place": "home_valley", "x": 4.0, "z": 2.5 },
  "settings": { "time": "clock", "season": "calendar", "hemisphere": "north", "quality": "medium", "master": 0.8 } }
```

### 9.6 Starting balance (home valley; edit freely in data)
Rule of thumb: about 5 units per tree and 4–6 per boulder, about 3 s per node, about 5–10 s walking between nodes.

| Order | Building | Cost | Gathering it takes | Response |
|---|---|---|---|---|
| 1 | Caretaker's shelter | 6 wood | 2 trees, ~30 s | Mist lifts from the clearing; a sit spot appears |
| 2 | Gravel garden | 4 wood, 6 stone | 1 tree, 2 boulders, ~1 min | Raking ritual; the pond clears and the deer arrives |
| 3 | Meditation hall | 14 wood, 10 stone | 3 trees, 2–3 boulders, ~2–3 min | Lanterns along the path; first caretaker note |
| 4 | Bell tower | 10 wood, 8 stone | 2 trees, 2 boulders, ~2 min | Bell ritual; the trail gate to the bamboo grove opens |
| 5 | Tea house | 6 wood, 8 bamboo | needs the grove | Tea ritual; home now feels lived in |

The home valley alone takes about 10–15 minutes including walking and sitting, and the first journey adds 10–15. Pacing is meant to feel unhurried, not long.

---

## 10. Phases

There is **one** sequence. Each phase ends at a gate the owner checks by playing. The agent does one phase per session unless the owner says otherwise, then reports and stops.

### Phase 0: Fork the engine
- New TypeScript project at the root of this repo (`zen`), with the build, serve and test scripts, `tsconfig.json` and manifest copied from Lanternfall (see 9.1).
- Copy and trim Lanternfall's engine: renderer, quality tiers, painterly materials, outlines, post-process, terrain, water, sky, particles, synth audio, save, touch. Remove everything tower-defense.
- A first home island using the engine's painterly pipeline: terrain, a pond, a few trees and rocks, sky and fog from one daytime preset. A placeholder caretaker capsule and the follow camera.
- Input: one move vector (keyboard, gamepad, touch joystick) plus one context action.
- GitHub Actions runs `npm run typecheck`, `npm test` and `npm run build` on every push.
- `AGENTS.md` (see Appendix A), `README.md`, `TASKS.md`, `docs/ART_PIPELINE.md`, `docs/CHANGELOG.md`.
- **Art decision point A1 (2D vs 3D) is due at this gate.** The agent must ask the owner to confirm before Phase 1.
- **Gate:** the built `index.html` opens on PC and in a phone browser, the island renders with the engine's painterly pipeline (Lanternfall's look is fine for now; Phase 2 retunes it), holds frame rate on Medium on the phone, and the capsule walks around with the joystick. CI is green.

### Phase 1: The feel
- 8-way movement with good acceleration and stopping, collisions, camera follow with damping.
- Automatic chopping and chipping on the beat with a visible caretaker animation and pentatonic notes; trees and boulders that visibly deplete with every unit and regrow gradually; the basket filling item by item; the HUD chip.
- One build site (the shelter) with automatic deposit and part-by-part growth (one simple procedural part per unit, animating into place, visibly incomplete when short of materials), a completion bell, and a first restoration response (mist lifts).
- Saving and loading of deposits, satchel and position; autosave when the page is hidden.
- The headless loop in `sim/` with unit tests: gather awards, satchel cap, deposit never exceeds cost, derived progress, save round trip, corrupt save fallback. A first pacing-bot run reports the cycle time.
- **Art decision points A2 (camera) and A3 (world scale) are due at this gate.** Offer two or three camera and scale options to try on the phone.
- **Gate:** on a phone, someone new to the game gathers and builds the shelter without being told how, and keeps gathering afterwards. Closing the tab mid-deposit and reopening keeps exactly what was delivered.

### Phase 2: Warm the look
- The Zen kit as procedural models: cherry, maple and bamboo; mossy stones; stone lanterns; rope and post fences; raked gravel; stepping stones; lotus. Building parts (posts, beams, walls, tiled roof, scaffolding) that buildings assemble from one piece per unit. Tree and boulder depletion and regrowth states for every gatherable kind.
- The real caretaker model (robe, bun, wicker basket that fills) and the deer.
- Presets for time of day (dawn, day, golden hour, dusk, night) blended from the clock, with a debug slider.
- Build the look presets and the look switcher from 7.4, with at least the Painted, Lanternfall-like and wildcard presets, applying the retuning checklist from 7.1 for Painted.
- **Art decision points A4, A5 and A6 are due at this gate.** Show screenshot sets of every preset and warn the owner before locking.
- **Gate:** the owner has tried the presets on their phone and picked a direction. If it's Painted, a phone screenshot next to the reference image should read as the same world, not as Lanternfall. `docs/ART_PIPELINE.md` records the final shader values and rules.

### Phase 3: Home grows
- All home-valley buildings except the tea house, the restoration system across the valley, real-clock time of day with settings, sit-and-watch, rituals (bell, rake, lanterns at dusk), poem stones and caretaker notes, the deer.
- Audio pass 1: gathering timbres, ambience by time of day, the bell.
- **Gate:** from a fresh save the home valley is completable in about 10–15 minutes; before and after look clearly different; the game reads with sound muted.

### Phase 4: The first journey
- The trail out of the valley to the bamboo grove (walked the first time), place transitions, the bamboo material, wind shrine restoration, the crane, grove poem stones and sit spots.
- The travel map, unlocked after the first visit. The tea house at home.
- **Gate:** walk to the grove, restore the shrine, bring bamboo home, build the tea house, travel back by map. Reloading at any point lands you somewhere sensible with nothing lost.

### Phase 5: Seasons, collections, decorating
- Calendar seasons with palettes, ground cover and seasonal ambience, plus the hemisphere and season settings.
- A few seasonal findables per place.
- The collection book (poems, animals, seasonal finds), wordless where possible.
- Decorating v1: place, rotate and remove decorations on decoration-allowed ground at home. Decorations come from shrines and buildings, never from purchases.
- **Art decision point A7 (seasonal palettes) is due at this gate.**
- **Gate:** setting the season to each of the four makes both places look clearly different; decorations persist; nothing seasonal blocks progress.

### Phase 6: Polish and share
- Audio pass 2, settings and accessibility (reduced motion, text size, high-contrast prompts, remappable keys), performance pass on a low-end phone.
- Hosting: publish the built file (for example on GitHub Pages, or next to Lanternfall in the owner's games collection), installable as a web app. App-store wrapping only if wanted.
- **Gate:** a friend opens the link on their phone or PC, adds it to their home screen, and plays from start to finish with no help.

### Later (one at a time, each its own small plan)
Riverbank, mountain pass and further journeys · quiet residents · more rituals · weather moments (rain, snowfall) · more decorations · a photo mode (fits "sit and watch").

---

## 11. Definition of done (every phase)
- The phase's features work in a fresh run on **a PC browser and a phone browser**.
- Typecheck, tests and build pass, and CI is green. A browser smoke test (Playwright, as Lanternfall's `tests/lanternfall.browser.cjs` does) loads the game at phone and laptop sizes. When something couldn't be run, the report says so plainly.
- No soft-locks on the usual path. Save, quit and resume works at any point.
- `README.md`, `TASKS.md` and `docs/CHANGELOG.md` are updated.
- The report includes changed files, what to try, test results, known gaps, a screenshot or short clip where possible, and the proposed next phase.

---

## 12. Open decisions

| Decision | Current default | Decided at |
|---|---|---|
| Art style | Leading candidate: the painted reference (`docs/art-reference.jpg`), built with Lanternfall's engine. **Not final:** the owner picks from look presets | Art decision points A1–A7 in 7.4 |
| Where the code lives | The `zen` repo, with the engine copied from Lanternfall | Phase 0 (alternative: a `games/moss-and-bell` folder next to Lanternfall) |
| Shared engine with Lanternfall | Copy now, adapt freely | Revisit only if both games keep changing the same engine code |
| When quiet residents arrive | After the first complete version | After Phase 6 |
| Exact poem and note text | Placeholders | Owner writes during Phase 3–4 |
| Second journey destination | Riverbank | After Phase 6 |
| Music or silence by default | Ambience only, music optional | Phase 6 |
| Final name | Moss & Bell | Any time |

---

## Appendix A: `AGENTS.md` (the agent creates this in Phase 0)

```markdown
# Agent rules for Moss & Bell
- Read Moss_and_Bell_Plan_v2.md (the plan) and TASKS.md before changing anything.
- Work on ONE phase per session (current phase is in TASKS.md). Stop at the gate and report.
- Keep the game runnable at every commit. Run: npm run typecheck, npm test, npm run build.
- Balance numbers live in data/ only. Save facts, derive everything else.
- Game rules live in src/sim and never import three.js.
- Every proximity interaction implements the interface in src/sim/proximity.ts.
- Models are built in code; follow docs/ART_PIPELINE.md for scale, outlines and palette.
- The art target is the painted reference (plan section 7.1, docs/art-reference.jpg), NOT Lanternfall's look. It is not final yet.
- ART DECISIONS: before building on an undecided art decision point (plan 7.4, A1–A7), STOP and warn the owner: what must be decided, options with screenshots, what gets expensive to change afterwards, and your recommendation. Never lock one silently.
- No external assets without source + license logged in docs/ART_PIPELINE.md.
- Never claim a test, build, or device check that you did not actually run.
- Report: changed files, how to try it, test results, gaps, next step.
```

## Appendix B: What changed from v1
- The three hooks (growth, rhythm, stillness) now drive every decision. Visitors and dialogue are no longer the climax.
- Gathering and depositing are automatic and on a beat. Buildings grow one part per unit delivered instead of in a 3-step animation, and gathering visibly depletes trees and boulders (nothing jumps from 0 to 100%).
- The world grows through journeys (walk first, map after), with a home hub and shrines, instead of one map with one bridge.
- Phone and PC are equals from Phase 0, not phone "later".
- The world runs on the real-world clock and calendar, with settings.
- The game is open-ended (decorating, collections, seasons, new journeys) instead of a 15–25 minute slice with an ending.
- Animal friends now, quiet residents later, instead of a dialogue-driven visitor.
- Built on the owner's Lanternfall engine (three.js + TypeScript) instead of Godot. Its tools carry over (procedural models, painterly shaders, phone support, save, synth audio), retuned toward the painted reference image rather than Lanternfall's own look.
- One phase sequence replaces the three overlapping numbering schemes, and v1's references to files that don't exist are gone.
- Saved facts with derived progress, and no saved timers, remove whole classes of save and duplicate-purchase bugs.
