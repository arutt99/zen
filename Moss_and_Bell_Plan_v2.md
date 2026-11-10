# Moss & Bell: Game Plan v2

**Status:** Replaces `Moss_and_Bell_Detailed_Build_Plan.md` as the working plan. The v1 file stays for reference.
**Built by:** an AI coding agent (Codex, Claude Code or similar) as engineer; the owner as director and tastemaker.
**Kind of project:** personal passion project. No commercial pressure, no monetization.
**Engine:** Godot 4 (latest stable at project start, pinned), GDScript, 3D scenes, Compatibility renderer.
**Platforms:** phone and PC as equals from the first playable build. Browser is optional later.

---

## 1. The vision in one paragraph

You arrive at an overgrown mountain valley with an empty satchel. Walk up to a fallen branch or a mossy stone and the caretaker gathers it on their own, in a calm, steady rhythm. Walk to a marked foundation and what you carry flows into it piece by piece, so you watch a hall rise beam by beam. As the home monastery grows, the valley heals: mist thins, flowers spread, animals arrive. Then you follow a trail out of the valley to new places, like a bamboo grove, a riverbank or a mountain pass. Each has its own small shrine to restore and a new material to bring home. The world follows your real clock and calendar. At any point you can sit on a bench, let the interface fade away and just watch the place live. The game has no ending; it's a place you keep going back to.

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
4. **Respect for Zen.** A fictional, Zen-inspired place. No enlightenment meter, no spiritual currency, no caricature of real practice. Everyday work is shown as care.
5. **Light words.** The place tells its own story. Words are rare and therefore valued: poems, notes from earlier caretakers, a signpost.

### Non-goals (for everything in this plan)
Combat, dialogue trees, quests and quest logs, crafting trees, a shop or currency, multiplayer, procedural generation, accounts or servers, monetization, and stat upgrades.

---

## 3. The core loop

**Gather → carry → deposit → watch it grow → the land responds → explore further.**
One cycle takes 30–90 seconds. A building takes 1–4 cycles.

### 3.1 Gathering (automatic)
- Gather nodes: fallen branches, loose stones and, in later places, bamboo, clay and others. Each node holds a small number of units (default 3).
- Walk into a node's gather radius and the caretaker turns to it and gathers **one unit per beat** (default beat 0.55 s). Walking away stops gathering, and every beat's unit has already been awarded. There is no "reward on completion" state to get wrong.
- Each beat plays one note from a pentatonic scale, rising through the node's units. A small particle and a satchel bump confirm the gather.
- An empty node rests, then regrows gently (default 20–40 s), shown by a visible change such as branches settling back. There are always enough nodes nearby that the player never has to wait.
- Show the harvest as collecting fallen and loose material, never felling trees or breaking rock violently.

### 3.2 Carrying
- The satchel holds a modest amount of each material (default 20) and visibly fills. The gentle cap is what creates the walk between gathering and building, which is part of the rhythm. Capacity never upgrades.
- A small HUD chip shows what you carry. It hides when the satchel is empty.

### 3.3 Building (automatic deposit, visible growth)
- A build site is a soft-edged ground marker with a ghost outline of the structure. Standing on it shows the cost as icons with how many are still needed.
- While the player stands on the site, materials flow from the satchel into it **one per beat**, with an arc of the item and a soft wooden or stone note.
- **The building grows as you deposit.** Each building has 4–6 visual stages tied to the share of materials delivered (foundation stones → posts → beams → roof → details). Partial progress is saved and stays forever.
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
- Engineering: one `WorldClock` service supplies `time_of_day (0–1)` and `season`. Everything else reads from it, and a debug override lets you test any moment.

---

## 6. Controls and platforms

| Action | Phone | PC |
|---|---|---|
| Move | Floating joystick anywhere on the left 60% of the screen | WASD / arrows / left stick |
| Gather, deposit | Automatic | Automatic |
| Context action (sit, ring the bell, read a poem, open the map) | One large contextual button that appears only when useful | E / Space / gamepad A |
| Menu | Small corner button | Esc / Start |
| Camera zoom | Pinch (two presets) | Mouse wheel / bumpers |

- Landscape on both. Logical resolution 1280×720 with expand scaling, safe-area aware on phones.
- Touch targets at least 48 dp. Nothing depends on hover or right-click.
- **Every phase gate is checked on a real Android phone and on PC.** iOS builds need a Mac; plan them for Phase 6 and keep the code iOS-safe throughout.
- Performance target: steady 60 fps on PC and a mid-range phone at the first place. Fall back to 30 fps on low-end devices.

---

## 7. Art direction

### 7.1 Decision status: **not yet chosen.** Default: 3D with a painted look.
The three candidates are compared in the art-direction sample page (published separately):
1. **2D painterly:** hand-painted sprites and the strongest storybook look, but every building stage and season must be painted. This fights the open-ended, seasonal, multi-place vision.
2. **3D soft low-poly:** cheapest and most flexible, but reads as a toy and looks closest to My Little Universe.
3. **3D painted look (default):** simple 3D models with banded toon shading, soft ink outlines, a paper-grain overlay and a watercolor-like palette. Seasons and time of day come from light and palette changes, and journeys reuse a kit of pieces.

Phase 0–1 builds in neutral graybox 3D, which suits options 2 and 3. **Phase 2 is a style spike** that renders the real first building in options 2 and 3 on a phone (and a 2D mock if the owner still wants to see it), then **locks the style** at its gate. Choosing 2D at that point means switching the world to 2D nodes; the data, save, clock and loop systems carry over unchanged.

### 7.2 Look and feel (applies to any style)
- A living storybook: warm, soft, low contrast, readable silhouettes.
- Starting palette: moss `#779777`, fern `#A3B591`, cedar `#846B50`, light wood `#D9C39D`, warm paper `#F2E4C8`, stone `#9D9C8B`, mist water `#8CACAE`, lantern `#F4C98A`, plum accent `#D8A2A1`, roof slate `#5F6B6A`.
- A fixed, tilted camera (about 35–45° down, narrow FOV) that follows with damping. Not rotatable in the first version.
- An original caretaker: small, round, loose robe, satchel. Readable at phone size.
- Use fewer ambient effects, done well: petals, water shimmer, lantern sway, mist, fireflies at night.
- **Distinct from the inspiration:** no stack of items on the character's back, no bright saturated toy palette, no copied UI shapes or terminology.

### 7.3 Asset reality
The agent builds with original placeholders (primitives, simple models, procedural materials) under stable file names. Every placeholder is listed in `docs/ART_PIPELINE.md` with its dimensions, pivot, scale, poly budget, source and license. No assets pulled from web searches. Final art (commissioned, an asset pack or generated with clear rights) comes in through that pipeline later and never blocks gameplay work.

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

### 9.1 Principles
- **Content is data.** Places, materials, buildings, stages, decorations, animals, poems and seasonal palettes are Godot `Resource` (`.tres`) definitions with stable string IDs. Balance numbers live only in data.
- **Store facts, derive the rest.** The save stores facts (materials delivered per site, places discovered, items found, decorations placed, settings). Restoration level, unlocked sites, map entries and animal presence are **derived from those facts on load**. That makes "an objective replays after reload" or "duplicate build" impossible by construction.
- **No timers in saved state.** Node regrowth is not saved; nodes start full on load. Building growth is per deposit, so there is no "mid-construction" state.
- **Signals over polling**; small scenes, small scripts; typed GDScript where it helps readability.

### 9.2 Services (autoloads)
| Service | Responsibility |
|---|---|
| `GameState` | Satchel contents, site deposits, discovered places, collection, decorations. The only place facts change. Emits signals. |
| `Content` | Loads and validates all definitions at boot and reports bad data clearly. |
| `Progress` | Pure functions that derive restoration, unlocks and animal presence from `GameState` + `Content`. Easy to unit test. |
| `WorldClock` | Real or overridden time of day and season. Debug override. |
| `SaveManager` | Versioned JSON in `user://`, written to a temp file then renamed. Safe fallback on corrupt or missing saves, migration hook per version. Autosaves on every completed deposit batch, place change and app pause/background (important on phones). |
| `AudioManager` | Buses, the beat clock for gathering and deposit notes, non-repeating one-shots. |
| `PlaceLoader` | Loads and unloads place scenes, handles trail transitions and map travel, and positions the player. |

### 9.3 Scenes
```text
Main
├── PlaceRoot            (current place scene: HomeValley.tscn, BambooGrove.tscn, ...)
│   ├── Terrain / Water / Props (props carry restoration tags)
│   ├── GatherNodes      (GatherNode.tscn instances)
│   ├── BuildSites       (BuildSite.tscn instances, staged meshes)
│   ├── SitSpots, PoemStones, RitualSpots
│   ├── Animals
│   └── Exits            (trail ends → PlaceLoader)
├── Player               (CharacterBody3D, proximity sensor Area3D)
├── CameraRig
├── Lighting             (driven by WorldClock: sun, sky, fog, palette params)
└── UI (CanvasLayer)     HUD chip, context button, joystick, map, collection book, settings
```

### 9.4 One proximity rule
The player has one sensor. Each frame it picks **one** target by priority: build site you're standing on > gather node in range > context interactable (sit, poem, bell, map). Gather nodes and build sites act automatically. Context interactables show the context button. Everything proximity-based extends one base script, `Proximity.gd` (Area3D), with `priority`, `is_available()`, `on_enter()`, `on_tick()` and `on_exit()`.

### 9.5 Example definitions
```gdscript
# data/buildings/meditation_hall.tres  (BuildingDef)
id = "meditation_hall"
place = "home_valley"
cost = { "wood": 14, "stone": 10 }
requires = ["gravel_garden"]
stages = 5
restoration_value = 0.3
```
```json
{ "save_version": 1,
  "deposits": { "small_shelter": { "wood": 6 }, "meditation_hall": { "wood": 9, "stone": 2 } },
  "satchel": { "wood": 3 },
  "discovered_places": ["home_valley"],
  "collection": ["poem_first_light", "animal_deer"],
  "decorations": [],
  "current_place": "home_valley", "player_pos": [4.0, 0.0, 2.5],
  "settings": { "time_mode": "clock", "season_mode": "calendar", "hemisphere": "north", "master": 0.8 } }
```

### 9.6 Starting balance (home valley; edit freely in data)
Rule of thumb: about 3 units per node, about 2 s per node, about 5–10 s walking between nodes.

| Order | Building | Cost | Gathering it takes | Response |
|---|---|---|---|---|
| 1 | Caretaker's shelter | 6 wood | 2 nodes, ~30 s | Mist lifts from the clearing; a sit spot appears |
| 2 | Gravel garden | 4 wood, 6 stone | 4 nodes, ~1 min | Raking ritual; the pond clears and the deer arrives |
| 3 | Meditation hall | 14 wood, 10 stone | 8 nodes, ~2–3 min | Lanterns along the path; first caretaker note |
| 4 | Bell tower | 10 wood, 8 stone | 6 nodes, ~2 min | Bell ritual; the trail gate to the bamboo grove opens |
| 5 | Tea house | 6 wood, 8 bamboo | needs the grove | Tea ritual; home now feels lived in |

The home valley alone takes about 10–15 minutes including walking and sitting, and the first journey adds 10–15. Pacing is meant to feel unhurried, not long.

---

## 10. Phases

There is **one** sequence. Each phase ends at a gate the owner checks by playing. The agent does one phase per session unless the owner says otherwise, then reports and stops.

### Phase 0: Toolchain and graybox
- Godot project at the repo root, version pinned in `project.godot` and the README.
- **Headless Godot for the agent:** a setup script that downloads the pinned Linux editor binary, so the agent can import, run tests and export inside its container. GUT as the test framework. A GitHub Actions workflow runs import + tests on every push.
- Input abstraction (move vector + context action) with keyboard, gamepad and touch joystick.
- A graybox home valley: ground, water, a few box and cylinder trees and rocks, a capsule player, the camera rig.
- `AGENTS.md` (see Appendix A), `README.md`, `TASKS.md`, `docs/ART_PIPELINE.md`, `docs/CHANGELOG.md`.
- **Gate:** the project opens and runs on PC; an Android debug build installs and you can walk around with the joystick; CI is green.

### Phase 1: The feel
- 8-way movement with good acceleration and stopping, collisions, camera follow with damping.
- Automatic gathering on the beat with pentatonic notes, node rest and regrowth, a visible satchel, the HUD chip.
- One build site (the shelter) with automatic deposit and staged growth from graybox pieces, a completion bell, and a first restoration response (mist lifts).
- Saving and loading of deposits, satchel and position; autosave on app pause.
- Unit tests: gather awards, satchel cap, deposit never exceeds cost, derived progress, save round trip, corrupt save fallback.
- **Gate:** on a phone, someone new to the game gathers and builds the shelter without being told how, and keeps gathering afterwards. Quitting mid-deposit and reopening keeps exactly what was delivered.

### Phase 2: Style spike and lock
- Lighting rig driven by `WorldClock` (debug slider for time of day).
- The shelter, one tree, one rock and the caretaker in **option 3** (toon ramp + outlines + paper grain) and **option 2** (flat-shaded low-poly). If the owner asks, also a quick 2D mock.
- Measure fps on the phone for each.
- **Gate:** the owner picks the style. It's recorded in this plan, and `docs/ART_PIPELINE.md` gets the rules: scale, pivots, poly budget, palette, outline width, shader parameters.

### Phase 3: Home grows
- All home-valley buildings except the tea house, the restoration system across the valley, real-clock time of day with settings, sit-and-watch, rituals (bell, rake, lanterns at dusk), poem stones and caretaker notes, the deer.
- Audio pass 1: gathering timbres, ambience by time of day, the bell.
- **Gate:** from a fresh save the home valley is completable in about 10–15 minutes; before and after look clearly different; the game reads with sound muted.

### Phase 4: The first journey
- The trail out of the valley to the bamboo grove (walked the first time), `PlaceLoader` transitions, the bamboo material, wind shrine restoration, the crane, grove poem stones and sit spots.
- The travel map, unlocked after the first visit. The tea house at home.
- **Gate:** walk to the grove, restore the shrine, bring bamboo home, build the tea house, travel back by map. Reloading at any point lands you somewhere sensible with nothing lost.

### Phase 5: Seasons, collections, decorating
- Calendar seasons with palettes, ground cover and seasonal ambience, plus the hemisphere and season settings.
- A few seasonal findables per place.
- The collection book (poems, animals, seasonal finds), wordless where possible.
- Decorating v1: place, rotate and remove decorations on decoration-allowed ground at home. Decorations come from shrines and buildings, never from purchases.
- **Gate:** setting the season to each of the four makes both places look clearly different; decorations persist; nothing seasonal blocks progress.

### Phase 6: Polish and share
- Audio pass 2, settings and accessibility (reduced motion, text size, high-contrast prompts, remappable keys), performance pass on a low-end phone.
- Windows and Android release builds, iOS if a Mac is available, web export as an option.
- **Gate:** a friend installs it on their phone or PC and plays from start to finish with no help.

### Later (one at a time, each its own small plan)
Riverbank, mountain pass and further journeys · quiet residents · more rituals · weather moments (rain, snowfall) · more decorations · a photo mode (fits "sit and watch").

---

## 11. Definition of done (every phase)
- The phase's features work in a fresh run on **PC and Android**.
- Import is clean, tests pass, CI is green. When something couldn't be run, the report says so plainly.
- No soft-locks on the usual path. Save, quit and resume works at any point.
- `README.md`, `TASKS.md` and `docs/CHANGELOG.md` are updated.
- The report includes changed files, what to try, test results, known gaps, a screenshot or short clip where possible, and the proposed next phase.

---

## 12. Open decisions

| Decision | Current default | Decided at |
|---|---|---|
| Art style | 3D painted look | Phase 2 gate |
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
- Keep the game runnable at every commit. Run: <import command>, <test command>.
- Balance numbers live in data/ only. Save facts, derive everything else.
- Every proximity interaction extends Proximity.gd.
- No external assets without source + license logged in docs/ART_PIPELINE.md.
- Never claim a test, build, or device check that you did not actually run.
- Report: changed files, how to try it, test results, gaps, next step.
```

## Appendix B: What changed from v1
- The three hooks (growth, rhythm, stillness) now drive every decision. Visitors and dialogue are no longer the climax.
- Gathering and depositing are automatic and on a beat. Buildings grow per deposit instead of in a 3-step animation.
- The world grows through journeys (walk first, map after), with a home hub and shrines, instead of one map with one bridge.
- Phone and PC are equals from Phase 0, not phone "later".
- The world runs on the real-world clock and calendar, with settings.
- The game is open-ended (decorating, collections, seasons, new journeys) instead of a 15–25 minute slice with an ending.
- Animal friends now, quiet residents later, instead of a dialogue-driven visitor.
- 3D is the default rendering path; the art style is locked at a dedicated spike phase.
- One phase sequence replaces the three overlapping numbering schemes, and v1's references to files that don't exist are gone.
- Saved facts with derived progress, and no saved timers, remove whole classes of save and duplicate-purchase bugs.
