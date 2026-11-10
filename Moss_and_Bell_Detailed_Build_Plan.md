# MOSS & BELL
## A Codex-Ready Game Development Blueprint
**Version:** 1.0  
**Status:** Design and implementation specification  
**Audience:** Codex acting as lead game engineer; human owner acting as product director  
**Target:** Windows desktop first; design for later Android/iOS and optional web export  
**Engine:** Godot **4.7.2 stable**, standard edition, **GDScript** (not C#)  
**Working title:** Moss & Bell (renameable)

---

## 0. Executive instruction to Codex

Build an original, peaceful, storybook-style **2D monastery-building adventure game**. The player directly controls a small caretaker walking through a natural mountain clearing. They collect wood and stone, open new areas, construct a monastery one structure at a time, care for gardens, and welcome gentle NPCs. It should feel immediately satisfying, tactile, and unhurried, with clear progression and pleasant audiovisual feedback.

**Do not** reproduce *My Little Universe* assets, layouts, character designs, terminology, UI, or other protected content. Borrow only the **high-level idea** of collecting resources to unlock spaces and buildings.

**Do not** start by constructing a huge simulation, nor reuse the previous single-file HTML demo as the foundation. Build a proper Godot project with reusable scenes, data-driven recipes, tests, save/load, and an orderly production roadmap.

**Quality priorities, in order:** (1) always playable, (2) responsive movement and interaction, (3) satisfying gather/build loop, (4) coherent visual presentation, (5) serene atmosphere, (6) scalable architecture. A modest but working game is better than a beautiful nonfunctional menu or mockup.

Use the phase gates in Section 14. Finish one milestone, validate it, and provide a concise playable report before beginning the next. Never claim that testing occurred if the required engine/runtime was unavailable.

---

## 1. Game vision

### 1.1 One-sentence pitch

*Begin with an overgrown mountain clearing and, one quiet action at a time, build a welcoming Zen-inspired monastery.*

### 1.2 Player fantasy

I arrive in a beautiful but neglected valley with only a small backpack and a few tools. By walking, collecting, restoring, gardening, and meeting visitors, I turn it into a peaceful sanctuary. My progress is tangible: a trail clears, a lantern lights, a hall rises from a foundation, a newcomer sits for tea.

### 1.3 Design pillars

1. **Presence over pressure.** No combat, hunger clock, death, crop deadlines, or punishment for logging off.
2. **Tactile satisfaction.** Every action has a clear animation, responsive timing, small audio cue, and visible world change.
3. **Small steps, enduring change.** Resources unlock buildings and places; completed work stays completed and transforms the grounds.
4. **A living storybook.** Warm painterly art, readable silhouettes, subtle ambience, and miniature expressive characters.
5. **Gentle community.** People are characters, not production machines; caring routines and hospitality unlock short stories.
6. **Respect for Zen.** No enlightenment score, spiritual “power” currency, or mockery of sacred practices. Show everyday work as an expression of care. This is a fictional, Zen-inspired world rather than an instructional portrayal of a specific tradition.

### 1.4 Explicit non-goals for v0.1

No multiplayer, procedural open world, branching narrative engine, advanced colony AI, combat, crafting trees with dozens of parts, weather simulation, multiplayer synchronization, large economy, paid content, or generated dialogue. No full 3D world. No mobile app-store deployment in the first milestone.

---

## 2. Audience, controls, and camera

### 2.1 Audience

Players seeking easy challenges, ASMR-adjacent repetition, a beautiful environment, and a gentle but real sense of accomplishment. Players should be able to enjoy 10–30 minute sessions without needing encyclopedic knowledge or complex systems.

### 2.2 Camera and world

- Use **2D top-down / 3/4-view** art: overhead enough to see paths and buildings, with visible front faces of buildings. **Not strict mathematical isometric** unless it is demonstrated to be equally accessible and clear.
- Camera follows player with gentle damping. Camera zoom has three presets (Near, Normal, Far); default must show the player, several nearby resource nodes, and the build site.
- Depth-sort sprites by their ground-contact Y coordinate; character can pass *behind* tree crowns/buildings but not through trunks/walls.
- Suggested logical viewport: **1280 × 720**, responsive scaling/letterboxing for other aspect ratios. Gameplay remains readable at 720p and 1080p.
- Use an authored, finite first map rather than infinite procedural generation. Suggested initial map: **64 × 48 tiles at 64 px**, adjusted during playtesting.
- Navigation includes a central clearing, forest edge, stone quarry, stream, blocked footbridge, and modest hill path. Structures are placed in authored building pads to control visual quality for v0.1.

### 2.3 Desktop controls

| Input | Action |
|---|---|
| WASD / arrows | Move in eight directions (normalized diagonals) |
| E / Space | Interact with nearby highlighted object |
| Mouse left click | Optional click-to-move and interact; add **after** keyboard play works |
| Tab / I | Open compact resources/objectives view |
| Esc | Pause / settings |
| Mouse wheel or +/- | Camera zoom, if implemented |

Interaction must be tolerant: show a highlight in range, use a generous radius, allow proximity assist/auto-face, and never demand precise pixel clicking.

### 2.4 Future mobile input requirements

Even before native mobile implementation, separate input intent from movement code so a floating joystick and one contextual action button can be added. Build for touch targets of roughly 44 pt/48 dp or larger. Do not make essential actions depend exclusively on hovering or right-clicking.

---

## 3. The core gameplay loop

**Explore → Gather → Deposit automatically → Build/restore → Unlock an area or community moment → Explore again.**

A single cycle should produce satisfying progress in roughly **30–90 seconds**, even when a larger construction needs several cycles.

### 3.1 Gathering

- Player walks to a resource, sees an outline and prompt, holds or taps Interact.
- Tree: 2 or 3 satisfying short tool swings; awards **+2 wood** per fully harvested node. Chipping particles, tiny camera response, crunchy wood sound, resource number floats upward. Avoid violent tree-felling presentation: depict careful gathering/pruning or collecting usable fallen limbs; visually refresh the source after a gentle regrowth interval.
- Stone: 2 or 3 taps; awards **+2 stone**. Gentle stone chips and a soft ceramic-like audio note.
- Resource nodes have cooldown/regrowth of ~15–35 seconds, tuned to prevent long waits. Provide at least three harvestable sources of each currently needed resource so the player never becomes blocked.
- Nearby drops auto-collect. No click-to-loot micro-management.
- Inventory begins with 99-unit caps per resource and no weight restrictions.
- The player can interrupt actions and move away; grant rewards only once on completion.

### 3.2 Building

- Building locations have **subtle ground outlines** or an elegant “unfinished structure” marker, not loud neon grids.
- When in range, display a small panel: building name, illustration or icon, recipe, owned quantities, and resulting benefit.
- If resources are insufficient, show the shortfall clearly; if affordable, one button begins construction.
- Costs deducted once, atomically; construction moves through **foundation → timber frame → completed structure** over ~2–4 seconds.
- Construction is irreversible in v0.1 but can be restarted with a new save. No placement puzzles in the first vertical slice.
- Completion triggers a soft bell/chime, dust/petal burst, a tiny celebration animation, and a newly available objective.
- A built structure must visually persist after saving/loading. The character must not clip inside it.

### 3.3 Soft objectives

Present one pinned main objective and optionally one unpinned optional activity; never show a cluttered quest log. Each objective should answer “What can I do next?” without making the player feel late.

### 3.4 Reflective activities

After the core loop works: sweep leaves, tend vegetables, pour tea, ring the bell, and sit for a short rest. These are optional interactions with delightful animation/sound, not daily chores or spiritual XP multipliers.

---

## 4. Exact vertical-slice content (the first complete experience)

**Target first complete playthrough:** 15–25 minutes for a new player. **First playable milestone:** 3–7 minutes.

### 4.1 The opening scene

Dawn in an overgrown mountain valley. A small character stands near an old stone path. One ruined foundation sits beyond the clearing. Trees, moss-covered stones, a visible creek, distant roof silhouettes, and birds create an inviting mystery. A brief text prompt: **“A quiet place can begin with one small act.”** Skip button available. No mandatory cinematic.

### 4.2 Resources

| ID | Source | Yield | Role |
|---|---|---:|---|
| `wood` | 4–8 small tree/branch nodes | 2 per completed interaction | Basic buildings, bridge |
| `stone` | 3–6 stone outcrops | 2 per interaction | Foundations, garden, bridge |
| `tea_leaves` | Garden plot, **optional later** | 1–3 | Gentle side interaction, not a blocker |

### 4.3 Construction progression

Values below are **starting balance targets**, not permanent design laws. Keep editable in data files.

| Order | ID | Name | Wood | Stone | Unlock / feedback |
|---|---|---|---:|---:|---|
| 1 | `small_shelter` | Caretaker's Shelter | 6 | 0 | A place to rest; teaches building |
| 2 | `stone_garden` | Quiet Stone Garden | 4 | 4 | Optional raking interaction; reveals new stone path |
| 3 | `footbridge` | Creek Footbridge | 10 | 4 | Opens far bank and new trees/rocks |
| 4 | `meditation_hall` | Meditation Hall | 12 | 8 | Visitor arrives, short dialogue and sitting activity |
| 5 (stretch) | `tea_house` | Tea House | 10 | 6 | Small hospitality vignette; first enduring community sign |

First completion condition: shelter, garden, bridge, and meditation hall built; visitor greeted; player free to explore. Tea house is optional stretch for the first slice.

### 4.4 Narrative beats

1. **Arrival:** a neglected but welcoming place.
2. **First Shelter:** a short notice: *“Every quiet place begins somewhere.”*
3. **The Garden:** tending a few stones reveals a peaceful pause.
4. **Across the Creek:** a new part of the valley becomes reachable; reveal uses camera framing, not hard cuts.
5. **First Visitor:** a wanderer named **Aki** arrives and asks for a place to sit. Three short lines of dialogue; player can invite them inside. Avoid presenting the character as an authoritative Zen master.
6. **The Bell of Evening:** completing the hall produces a brief sunset transition and a gentle bell, not a victory score screen. Continue playing after credits/thanks.

### 4.5 Art assets required for the vertical slice

- 1 player, with **idle and walk animations** in four directional sets (up, down, left, right; diagonal can mirror/approximate), and one short interaction animation.
- 2 resource objects (tree, boulder) with normal/harvested state.
- 4–5 building types, each with unfinished/foundation, mid-construction, and finished variant.
- 1 NPC with idle/walk animations, simple interaction portrait or expressive icon.
- Ground textures: path, grass, moss, river bank, shallow water, stone, dirt.
- Decorative layers: ferns, wildflowers, bamboo, lantern, wooden sign, falling petals, small pond, mountain background.
- UI: 2 resource icons; contextual action prompt; building cost panel; objective strip; pause/settings; tiny dialogue panel.
- Sound: footsteps (soft), wood tap, stone tap, pickup, UI tick, construction, wind, stream, birds, bell. Music optional, must have mute/volume control.

---

## 5. Storybook art direction

### 5.1 Visual thesis

Imagine a **living illustrated children's storybook for adults**: hand-painted surfaces, warm low-contrast lighting, softened outlines, charming proportions, and natural environmental motion. Avoid cold mobile-tycoon polish, high-gloss 3D, hard black pixel outlines, noisy procedural textures, and excessive UI chrome.

### 5.2 Palette (starting guidance)

- Moss/fern: `#779777`, `#A3B591`
- Cedar/wood: `#846B50`, `#B18F69`
- Warm paper: `#F2E4C8`
- Stone: `#9D9C8B`
- Mist-blue water: `#8CACAE`
- Lantern light: `#F4C98A`
- Accent plum/pink: `#D8A2A1`

Use colors as inspiration, not rigid tokens. Contrast of interaction prompts should meet basic accessibility expectations even if scenery is muted.

### 5.3 Environment principles

- Painterly transparent PNG sprites layered over an authored tile map; do not use one huge flat background image for the actual traversable game.
- Clear ground contact points for proper occlusion and Y-sorting.
- Each resource must be recognizable at game camera distance.
- Silhouette first: simplify background detail where it interferes with player readability.
- Ambient animation: slowly drifting petals, water shimmer, lantern sway, tiny grass movement, occasional mist. Fewer well-executed effects are better than constant movement everywhere.
- Use multiple seasonal accents as a **future** option; first slice uses spring or early autumn consistently.

### 5.4 Character direction

A small, expressive caretaker in loose practical robes, simple sandals, and a soft cloth satchel. Use an **original** silhouette, not a direct copy of any reference game. Face/animation should be readable at approximately 48–80 px character body height at normal zoom.

### 5.5 Asset reality / Codex instructions

Codex cannot be presumed to generate production-grade watercolor illustrations merely by writing code. During implementation, use **coherent original placeholders** (SVG shapes, small textures or simple painted-looking PNGs with proper licensing) and stable asset filenames. Leave clean slots for final commissioned/generated art. Never silently pull random copyrighted images from web searches. Document exact dimensions, anchor positions, atlas sizes, animation frames, license/source, and replacement workflow in `docs/ART_PIPELINE.md`.

Create an **art integration milestone** after movement and gathering are functional. Do not let pursuit of perfect artwork block the first playable game.

---

## 6. Audio and atmosphere

- Use separate buses for `Master`, `Ambience`, `Effects`, `Music`.
- Keep sounds warm and light; no harsh arcade pickups.
- Ambient loops: flowing stream and distant birds, with randomized subtle variation; prevent multiple overlapping identical loops.
- Important actions: wood tap, stone tap, pickup, construction success, bell.
- Include immediate UI feedback even if audio is muted.
- User can mute all sound on the start/pause screen; remember settings.
- Avoid surprise loudness. Normalize playback and test on speakers/headphones.

---

## 7. UX / screen layout

**In-world experience:** No start gate blocking gameplay. Initial splash, if any, offers `Continue`, `New Game`, `Settings` and enters game after one click. Loading should never be presented as an inert full-screen overlay.

**HUD:** top left compact objective (“Gather wood for the shelter”), top right small resource values (wood/stone), bottom center context action with key hint when in range. No constant quest arrows or red alerts. Optional objective visibility toggle.

**Build interaction:** nearby site highlights with a restrained halo. Panel says `Caretaker's Shelter`, `Wood 6/6`, `Build`, and one sentence explaining why it matters. Disabled button says why.

**Accessibility:** readable font size; optional reduced screen shake; adjustable master and FX levels; keyboard and controller mapping designed for later; high-contrast prompt mode; no required timed inputs. Pause available everywhere except a brief noninteractive transition; even construction can be paused safely.

---

## 8. Technical architecture: Godot project

### 8.1 Recommended tree

```text
moss-and-bell/
├── project.godot
├── AGENTS.md
├── README.md
├── BUILD_PLAN.md
├── TASKS.md
├── LICENSE.md
├── .gitignore
├── assets/
│   ├── art/{characters,terrain,trees,rocks,buildings,props,ui}/
│   ├── audio/{ambience,sfx,music}/
│   └── fonts/
├── data/
│   ├── buildings/
│   ├── resources/
│   ├── objectives/
│   └── dialogue/
├── scenes/
│   ├── boot/Main.tscn
│   ├── world/Valley.tscn
│   ├── player/Player.tscn
│   ├── resources/ResourceNode.tscn
│   ├── buildings/BuildingSite.tscn
│   ├── buildings/Building.tscn
│   ├── npc/Visitor.tscn
│   ├── ui/HUD.tscn
│   ├── ui/BuildPanel.tscn
│   └── ui/PauseMenu.tscn
├── scripts/
│   ├── autoload/{GameState,SaveManager,AudioManager,EventBus}.gd
│   ├── player/PlayerController.gd
│   ├── interaction/InteractionController.gd
│   ├── resources/ResourceNode.gd
│   ├── buildings/{BuildingDefinition,BuildManager,BuildingSite}.gd
│   ├── progression/{ObjectiveDefinition,ObjectiveManager}.gd
│   ├── npc/Visitor.gd
│   └── ui/{HUD,BuildPanel}.gd
├── tests/{unit,integration}/
└── docs/{ART_PIPELINE,PLAYTEST,CHANGELOG}.md
```

Folders and names may be adjusted slightly to match functioning Godot conventions, but retain separation of concerns. Prefer `.tres` `Resource` assets for Godot-native definitions where practical.

### 8.2 World scene outline

```text
Main (Node)
├── Valley (Node2D)
│   ├── Ground (TileMapLayer)
│   ├── Paths (TileMapLayer)
│   ├── Water (TileMapLayer / effect nodes)
│   ├── PropsBehind (Node2D)
│   ├── Sortables (Node2D, y_sort_enabled)
│   │   ├── Player (CharacterBody2D)
│   │   ├── ResourceNodes (Node2D)
│   │   ├── BuildingSites (Node2D)
│   │   └── Visitors (Node2D)
│   ├── ForegroundOverlays (Node2D)
│   └── Camera2D (or child of Player)
└── HUD (CanvasLayer)
```

Use Godot 4.x `TileMapLayer` rather than a deprecated single `TileMap` pattern. Use `CharacterBody2D` for player movement and `Area2D` for interaction zones. Avoid physics-heavy solutions for simple interactions.

### 8.3 Autoloads / service responsibilities

- **GameState:** resources, current unlocks, completed objectives, building state, play time. Exposes purchase/award operations; prohibits negative resources.
- **EventBus:** signals such as `resource_collected(type, amount)`, `building_completed(id)`, `objective_completed(id)`; document payloads.
- **SaveManager:** versioned JSON save and load with migration-ready schema and atomic-ish temp write/replace behavior; safe fallbacks for corrupt/missing files.
- **AudioManager:** bus volumes, randomized nonrepeating one-shots, global mute.
- **BuildManager:** verify prerequisites and resources, spend once, start/build/finish; do not bury purchase logic inside UI.
- **ObjectiveManager:** state changes from signals, not by hard-coded per-frame polling.

### 8.4 Data definitions

Use stable IDs, never display labels, for persistence. Examples:

```json
{
  "id": "meditation_hall",
  "display_name": "Meditation Hall",
  "cost": {"wood": 12, "stone": 8},
  "requires": ["footbridge"],
  "build_duration_seconds": 3.0,
  "footprint_tiles": [4, 3],
  "unlock_event": "visitor_arrival"
}
```

```json
{
  "save_version": 1,
  "player": {"x": 0, "y": 0},
  "resources": {"wood": 0, "stone": 0},
  "completed_buildings": [],
  "completed_objectives": [],
  "unlocked_areas": ["initial_clearing"],
  "settings": {"master_volume": 0.8, "reduce_motion": false}
}
```

These are illustrative schemas; Codex must implement actual class definitions/validation in Godot. Use `user://` for persistent saves and show the save location in the README. Settings can live in a separate file.

### 8.5 Interaction contract

All interactables expose a common method or interface-like pattern:

- `can_interact(actor) -> bool`
- `get_interaction_label() -> String`
- `interact(actor) -> void`
- optional `get_interaction_position() -> Vector2`

Godot GDScript may implement this via base class/shared script + signals or `has_method`; choose one consistent, testable convention. Prioritize the nearest valid interactable within range and highlight it; action key routes only to that target. Avoid double-triggering on key repeats.

### 8.6 Navigation and collisions

- Static collision on trees, stones, building walls, river edges.
- For the first NPC, simple authored waypoints and idle/rest states are enough. Do not add complex crowd navigation until needed.
- Building placement checks occupancy and player overlap before finalizing; if player stands in the footprint, move them to a valid nearby walkable tile or prevent construction with helpful text.
- Preserve accurate sprite draw order and free movement around the front of a building.

### 8.7 Saving

- Autosave on construction completion and objective milestone, throttled if necessary.
- Manual save from Pause menu.
- On loading, reconstruct world states deterministically: built structures, bridge traversability, resource counts, visitor unlocked, and objective progress.
- Make duplicate spending/building impossible even if the user clicks rapidly or reloads during construction.
- On missing/corrupted save, offer a safe new game and emit a meaningful log line instead of crashing.

---

## 9. Architecture for expansion (without prematurely building it)

Leave extension points for future modules but do not code their full logic now:

1. **Community:** 3–8 residents with daily loops and small stories, no productivity optimization.
2. **Rituals and care:** sweeping, tea preparation, gardens, lighting lanterns, meditation as optional micro-interactions.
3. **Building placement:** free-position placement/decorations instead of fixed pads after the vertical slice is enjoyable.
4. **Biomes:** bamboo grove, mountainside, creek, secluded rock garden, forest trail.
5. **Seasonal visuals:** spring petals, summer rain, autumn maple leaves, winter snow; no punitive weather.
6. **Philosophical scenes:** short, optional reflective dialogue with no “correct” answers required to win.
7. **Mobile:** virtual joystick and single action button; adaptive HUD and targeted performance work.
8. **Accessibility:** controller support, remapping, subtitles, reduced motion, broader color-contrast options.

Only implement one expansion at a time after reviewing player feedback and complexity.

---

## 10. Engineering quality rules for Codex

1. Keep the project **runnable at the end of every phase**. Check in working code, not half-integrated scripts.
2. Use small, focused scenes/scripts; prefer signals and dependencies over arbitrary global state.
3. Favor simple deterministic logic over complex animation/state-machine frameworks while scope is small.
4. Use typed GDScript where helpful; keep code readable for a hobbyist owner.
5. Comments should explain non-obvious reasoning, not repeat syntax.
6. Avoid unlicensed external assets. Record license/source for each externally supplied item.
7. All placeholders must be marked in `docs/ART_PIPELINE.md`; do not misrepresent them as production art.
8. Put balancing values in data, not hard-coded in UI or player scripts.
9. Include clear error messages and safeguards for absent references or invalid data.
10. Headless parse/import check after meaningful modifications, plus manual playtest instructions/screenshots when GUI is available.
11. Update `README.md`, `TASKS.md`, and `docs/CHANGELOG.md` after each phase.
12. If an automated step fails, report the failure plainly, fix if possible, and do not claim success.
13. Scope work to one phase per Codex request unless the human owner explicitly authorizes the next phase.
14. Commit by milestone with descriptive messages when Git is available and authorized.

---

## 11. Testing strategy

### 11.1 Tooling and automation

Use Godot's installed command line if available:

```bash
godot --headless --path . --editor --quit
```

This catches many import/parse issues but **does not prove gameplay correctness**. Create a minimal test harness or choose a compatible Godot testing framework only if it improves reliability without bloating dependencies. Document how tests are run. When no Godot binary is installed, do static file checks, then explicitly require the human to run Godot and report results.

### 11.2 Required test cases

- Start a new game; character immediately appears and responds to WASD/arrows.
- Diagonal movement speed equals axial speed; collisions block trees and water.
- Interaction prompt selects correct object at edge of range; no interaction out of range.
- Tree awards resources only once per harvest cycle, then regrows.
- Resources never become negative or unexpectedly exceed cap.
- Cannot build without sufficient resources; exact cost is spent once.
- Fast repeated button presses cannot buy the same building twice.
- Building footprint is not occupied by player after completion.
- Bridge changes traversability only once construction is complete.
- Completing a goal unlocks the next goal exactly once.
- Closing and reopening game restores the completed structures, position, counters, unlocked area, and visitor.
- Restart/new game clears save only after confirmation; no old world remnants.
- Pause works during normal movement and construction without corrupting progress.
- Muted sound means no audio; reduced-motion option reduces shake/particles.
- HUD stays legible at 1280×720 and with common window resize.
- Playtest first five minutes with no developer knowledge: can player discover trees, harvest, and build without instructions outside the game?

### 11.3 Performance bar

Aim at **60 FPS** on an ordinary modern Windows laptop at 1080p in the modest first scene; avoid frame-time spikes from repeated instantiation, unnecessarily large textures, and unbounded particles. Performance is a goal to measure, not a claim without benchmarking.

### 11.4 Definition of Done (each phase)

- All features in the phase work in a fresh project run.
- No new parse errors or unhandled runtime errors.
- No soft-locks in common interaction sequence.
- Tests/validation performed and reported; limitations listed.
- README and task tracking updated.
- A screenshot or short recording when environment permits (not a substitute for tests).
- Human owner can answer: “What changed, how do I run it, what should I try next?”

---

## 12. Suggested milestone releases

### Milestone A — Playable walkabout (approximately 2–5 focused coding sessions)

**Deliverable:** player walks through an authored clearing, camera follows, collisions and one interactable object work. Clear menu controls. Placeholders are fine. This validates art perspective and controls.

### Milestone B — Satisfying resource loop (2–4 sessions)

**Deliverable:** harvestable trees and rocks, pickup feedback, counter HUD, cooldown/regrowth, resource balance. A person should want to collect “one more” node.

### Milestone C — First construction (2–4 sessions)

**Deliverable:** shelter blueprint, affordability preview, cost transaction, staged build animation, persistence, post-build change. End-to-end 3–7 minute experience.

### Milestone D — Vertical slice (4–8 sessions)

**Deliverable:** bridge, garden, hall, unlocked far bank, one visitor, dialogue, autosave, polished HUD and audio. 15–25 minutes.

### Milestone E — Storybook polish and release candidate (variable)

**Deliverable:** cohesive art replacements, complete sound, accessibility settings, full playtest and Windows build. Optional web test later.

Session counts are **planning buckets, not promises or delivery estimates**. Prioritize one vertical slice rather than implementing every imagined system.

---

## 13. Backlog with clear acceptance criteria

### EPIC 0 — Repo and toolchain

**MB-001** Initialize Godot 4.7.2 GDScript project; main scene starts, no parse errors.  
**MB-002** Configure input actions, window scaling, scene tree conventions.  
**MB-003** Create README, AGENTS.md, TASKS.md, CHANGELOG and asset provenance log.  
**MB-004** Add placeholder art pack/primitive drawing system with clear ownership and editability.

**Acceptance:** fresh clone opens in Godot and runs a visible, nonblank scene; README reproduces steps.

### EPIC 1 — Movement and world

**MB-101** 8-way movement with normalized diagonals and idle/walk animation.  
**MB-102** Follow camera, zoom presets, optional edge limits.  
**MB-103** Authored terrain map, stream, small resource grove, collision and depth sorting.  
**MB-104** Target highlighting and `Interact` action route.

**Acceptance:** move around all open paths, see clear visual occlusion, cannot cross water or walls, interactable prompt appears within range and disappears when leaving.

### EPIC 2 — Gathering

**MB-201** Resource definitions (`wood`, `stone`) and ResourceNode scene.  
**MB-202** Harvest animation timing and one-award-per-completion.  
**MB-203** Inventory counters, capped resources, floating feedback, particles.  
**MB-204** Nonblocking regrowth and basic harvesting test cases.

**Acceptance:** gather from at least 3 wood and 3 stone nodes; counters update exactly, source enters cooldown then returns.

### EPIC 3 — Construction

**MB-301** Data-driven BuildingDefinition and affordability logic.  
**MB-302** BuildingSite UI with required/owned counts and contextual Build action.  
**MB-303** Atomic purchase, staged construction, collision/visual update.  
**MB-304** Implement shelter then garden then bridge; bridge updates traversability.  
**MB-305** Save/load building state and guard against duplicate construction.

**Acceptance:** gather six wood, build shelter, reload and see shelter still built, progress to bridge, cross after it is completed.

### EPIC 4 — Progression and NPC

**MB-401** Objective definitions / progression manager and HUD objective strip.  
**MB-402** Meditation hall and gate conditions.  
**MB-403** First visitor arrival, idle animation, short dialogue.  
**MB-404** Soft ending beat and post-completion free roaming.  
**MB-405** Optional rock-garden sweeping interaction.

**Acceptance:** novice player can reach ending without developer commands; no objective skips or replays on reload.

### EPIC 5 — Presentation, quality, release

**MB-501** Replace functional placeholders with coherent painterly assets and anchors.  
**MB-502** Audio bus setup and ambient layers.  
**MB-503** Pause/settings/saving/restart, volume, reduced motion.  
**MB-504** Visual polish and accessibility pass, performance pass.  
**MB-505** Export Windows desktop build, installation/use instructions, smoke-test checklist.  
**MB-506 (optional)** Web export and real iOS Safari verification before sharing as a browser game.

**Acceptance:** complete Windows build, no blocking bugs, owner can play start-to-end and can verify save/continue on a new session.

---

## 14. Phase-by-phase Codex execution orders

The human owner should ask Codex for **one phase at a time**, using the prompts below or `CODEX_START_HERE.md`. Each phase has a stop gate.

### Phase 0: Foundation

**Build:** project structure, `project.godot`, `Main.tscn`, one visible storybook-feeling clearing using original proxy shapes/assets, input map, camera basics, startup/pause menu, README, tests/documentation.  
**Gate:** opening Godot and pressing Run shows a nonblank, correctly sized scene with no errors.

### Phase 1: The character and paths

**Build:** controllable original character, idle/walk sprite states, 8-direction movement, collisions, Y sort, camera follow, interaction highlighting and an inert test marker.  
**Gate:** no movement jitter or direction bugs; interaction cue reliably appears; game plays without external HTML.

### Phase 2: Gathering

**Build:** trees and stone sources, animation, satisfying feedback, inventory, pickup, cooldown, resource data.  
**Gate:** the player can collect wood and stone continuously without counters lying, negative values, or softlocks.

### Phase 3: A structure rises

**Build:** shelter blueprint, cost UI, build logic, three-phase animation, obstacle handling, objective update, autosave.  
**Gate:** a player can gather exactly six wood and construct a persistent small shelter.

### Phase 4: Monastery expansion

**Build:** stone garden, bridge, far-bank reveal, meditation hall, building prerequisites and data, world state.  
**Gate:** 15–25 minute route through four constructions works from a clean save.

### Phase 5: People, sound, and atmosphere

**Build:** Aki NPC, short dialogue, ambient stream/birds/wind, tool sounds, soft bell, petals and lantern effects, settings.  
**Gate:** the game feels calm and readable; user can mute and still understand feedback.

### Phase 6: Polish, tests, and distribution

**Build:** final asset integration pipeline, improved visual cohesion, save corruption handling, accessibility, regression testing, Windows export; optionally scope web export separately.  
**Gate:** clean Windows build and repeatable smoke-test report.

**Mandatory reporting after EACH phase:** changed files, feature summary, how to launch, tests run/results, screenshots (if possible), known gaps, proposed next phase. Then **stop and wait for direction** (Codex should not silently implement future phases).

---

## 15. Specific first-session Codex request

Paste the message in `CODEX_START_HERE.md` as the first Codex instruction. Codex should read this plan and `AGENTS.md` before changing project files. It must start at **Phase 0 only**.

**In the first response/output, Codex should provide:**

1. The created Godot project file tree.
2. Exact prerequisites and launch commands.
3. Screenshot of the starting scene, if possible.
4. Successful/failed engine import and test results (with truthfully stated limitations).
5. The *next single task* recommended for Phase 1.

---

## 16. Product decisions needing human review later

These are not blockers to the first playable version; use the recommended defaults unless changed:

| Decision | Default now | Revisit after |
|---|---|---|
| Camera | 3/4 top-down | Movement playtest |
| Movement | WASD + arrows | Phase 1 |
| Art | Watercolor-inspired 2D | Phase 3 art review |
| Theme | Original fictional Zen-inspired setting | Narrative writing |
| Construction | Fixed pads | First complete slice |
| Resource nodes | Regenerate gently | Balance playtest |
| Time system | No enforced day deadlines | Phase 5 |
| Economy | Wood and stone | Post-slice expansion |
| NPC behavior | One scripted visitor | Phase 4 completion |
| Distribution | Windows first | Pre-release |

---

## 17. Sources and engine documentation

- Godot official releases and stable version archive: https://godotengine.org/download/archive/
- Godot documentation: 2D movement with CharacterBody2D: https://docs.godotengine.org/en/stable/tutorials/2d/2d_movement.html
- Godot 4 web export considerations: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html

**Engine note:** As of 2026-11-08, Godot 4.7.2 is the stable release listed on the official archive, while 4.8 remains in beta. If Codex uses a newer stable engine later, record the exact version and test compatibility before upgrading. GDScript is chosen for Godot-native development and future browser export; Godot 4 C# projects are not presently supported for web export per the cited Godot docs. Browser deployment is not the same as sharing a raw HTML file. Host Godot's full exported site and test the target browser.

---

## 18. Final acceptance definition of the vertical slice

A new player opens the actual Godot game and, with no external explanation, sees a beautiful, readable clearing; controls a small character; gathers from trees and rocks with satisfying feedback; constructs a first shelter; finds a stone garden; opens a bridge across the creek; builds a meditation hall; welcomes a visitor; hears a gentle bell; saves, quits, and resumes with progress intact. Every interaction functions, no hidden developer key is required, and none of the game's core progress depends on an external server or paid service.

**That — not just a looping animation — is the project Codex is building.**
