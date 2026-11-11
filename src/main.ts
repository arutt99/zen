// Moss & Bell — entry point. Phase 1: the home island on Lanternfall's engine, the core loop (gather on
// the beat → carry → deposit → watch it grow → the mist lifts), the HUD, and the save. Phase 2: the look
// (A6), the caretaker and deer (A4), building kits (A5), the time of day and the canopy fade. Phase 3:
// the whole home valley — four buildings that reveal themselves in turn, the restoration layer, sit
// spots, rituals (bell, rake, lanterns at dusk), poem stones and caretaker notes, the opening at the
// gate, and ambience by time of day. Phase 4: the first journey — places you travel between (the trail
// through the trail gate, walked the first time, then the travel map), the bamboo grove with its wind
// shrine and crane, bamboo carried home, and the tea house with its ritual.
// Game rules run in src/sim (CoreLoop); this file only wires them to rendering, sound and the page.
//
// Structure: everything that belongs to one place (its world, stage, loop, nodes, buildings, restoration
// layer, animals, sit spots, words, rituals and map board) is built by `enter()` and torn down when the
// caretaker travels. The facts (GameState), the caretaker, the camera, effects, HUD and settings stay.

import * as THREE from 'three';
import { audio, pentatonicRate } from './audio/audio';
import { ambienceMix } from './audio/ambience-mix';
import { GrowthLayer, type GrowthItem } from './render/growth';
import { staticLamps } from './render/rich';
import { duringTime, RITUALS, type RitualDef } from './data/rituals';
import { ARRIVALS, OPENING, WORDS } from './data/words';
import { FrameSmoother, ResolutionGovernor } from './core/pacing';
import { browserStore, loadSave, writeSave, type SaveData } from './core/save';
import { BEAT_SECONDS, MATERIALS, NODE_KINDS, SATCHEL_CAP, type MaterialId } from './data/gathering';
import { CAMERA_OPTIONS, SCALE_OPTIONS } from './data/feel';
import { PLACE_IDS, PLACES, type Arrival, type ExitDef, type PlaceDef, type PlaceId } from './data/places';
import { CHARACTER_STYLES, CARETAKER, type CharacterStyleId } from './data/characters';
import { BUILDINGS, buildingCost, KIT_STYLES, KIT_STYLE_INFO, type BuildingId, type KitStyleId, unitsForOldParts } from './data/buildings';
import { LOOKS, LOOK_IDS } from './data/looks';
import { MOMENTS } from './data/presets';
import { clockLabel, presetAt, timeOfDay } from './core/daylight';
import { DeerView } from './render/deer';
import { CraneView } from './render/crane';
import { look, reloadIntoLook, rich, useLook } from './render/look';
import { Wanderer } from './sim/animals';
import { defaultTier, type QualityTier } from './data/quality';
import { validateData } from './data/validate';
import { FollowCamera } from './render/camera';
import { CaretakerView } from './render/caretaker';
import { Engine } from './render/engine';
import { Fx } from './render/fx';
import { BuildingView } from './render/kits';
import { initMaterials, LAMPS, shared } from './render/materials';
import { Mist } from './render/mist';
import { nodeView, type NodeView } from './render/nodes';
import { Stage } from './render/stage';
import { IslandWorld } from './sim/island';
import { CoreLoop } from './sim/loop';
import { animalsPresent, completedAll, growthShown, mapUnlocked, mistAmount, partsBuilt, remaining, restoration, siteOpen, unlocked, waterMurk } from './sim/progress';
import { PRIORITY, type Proximate } from './sim/proximity';
import { GameState } from './sim/state';
import { InputController } from './ui/input';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** How long to wait for the graphics to come back before offering a reload (Lanternfall's value). */
const GFX_RESTORE_WAIT_MS = 6000;
/** Travel: the screen fades to paper, the next place is built, then it fades back in. */
const FADE_OUT_MS = 750, FADE_IN_MS = 1100;

function showBootError(msg: string): void {
  const el = $('boot-error');
  el.textContent = `Moss & Bell could not start.\n\n${msg}`;
  el.style.display = 'block';
}

function gpuName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase() : '';
}

type AnimalView = DeerView | CraneView;
type ContextTarget = Proximate & { act(): void };

function boot(): void {
  const problems = validateData();
  if (problems.length) {
    console.error('[data] problems:\n' + problems.join('\n'));
    if (__DEV__) { showBootError(problems.join('\n')); return; }
  }

  const store = browserStore();
  const { data: save, recovered } = loadSave(store);
  if (recovered) console.warn(`[save] started fresh: ${recovered}`);
  void navigator.storage?.persist?.().catch(() => undefined);
  // The look is chosen before anything is drawn: shaders are compiled for one look (src/data/looks.ts).
  // A6 is decided (Lanternfall+); other looks only with `?trial` (Settings) or `?look=` (screenshots, tests).
  save.settings.look = useLook(new URLSearchParams(location.search).has('trial') ? save.settings.look : 'lanternfallplus').id;

  let engine: Engine;
  try {
    engine = new Engine($('game') as HTMLCanvasElement);
  } catch (e) {
    showBootError(`WebGL is not available in this browser.\n${String(e)}`);
    return;
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const autoTier = defaultTier({
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    gpu: gpuName(engine.renderer),
  });
  const tierFor = (s: SaveData): QualityTier => (s.settings.quality === 'auto' ? autoTier : s.settings.quality);
  engine.setQuality(tierFor(save));
  initMaterials();

  // --- the facts: one GameState for every place (the satchel travels; a site may wait on another place)
  const allPlaces = PLACE_IDS.map((id) => PLACES[id]);
  const state = new GameState(allPlaces, save);
  const isPlace = (id: string): id is PlaceId => (PLACE_IDS as readonly string[]).includes(id);
  const firstVisit = save.at.place === '';
  // Where to start: the saved place and spot if it still stands up; else that place's way in; else home.
  const startPlace: PlaceId = isPlace(save.at.place) ? save.at.place : 'home_valley';

  // --- what stays across places: caretaker, camera, effects, input, sound
  const characterOf = (id: string): CharacterStyleId => (CHARACTER_STYLES as readonly string[]).includes(id) ? id as CharacterStyleId : 'chibi';
  const kitOf = (id: string): KitStyleId => (KIT_STYLES as readonly string[]).includes(id) ? id as KitStyleId : 'timber';
  // Phase 2 gate (owner, 2026-11-10): A4 chibi (locked) and A5 timber by default. The trial menu is hidden
  // (`?trial` shows it again for comparisons), so an older save's trial picks fall back to the decisions.
  const trial = new URLSearchParams(location.search).has('trial');
  if (!trial) {
    save.settings.character = 'chibi';
    save.settings.kit = 'timber';
  }
  save.settings.character = characterOf(save.settings.character);
  save.settings.kit = kitOf(save.settings.kit);
  let caretaker = new CaretakerView(characterOf(save.settings.character));
  const cam = new FollowCamera(engine.camera);
  const fx = new Fx(engine.quality.ambient > 0.6 ? 900 : 500);
  const input = new InputController($('game'), $('stick'), $('knob'));
  audio.setVolume(0.8, !save.settings.sound);
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  const timeNow = () => timeOfDay(save.settings.time, new Date());
  let dayT = timeNow();
  const hud = $('hud');
  /** Facts changed since the last write (written within a second). */
  let dirty = false;

  // --- the current place. Everything below is (re)built by `enter()`.
  const worlds = new Map<PlaceId, IslandWorld>();
  const worldOf = (id: PlaceId) => { let w = worlds.get(id); if (!w) { w = new IslandWorld(PLACES[id]); worlds.set(id, w); } return w; };
  let place: PlaceDef = PLACES[startPlace];
  let world = worldOf(place.id);
  let preset = presetAt(place.daylight, dayT);
  let stage = new Stage(world, preset, engine.quality, engine.renderer.getPixelRatio());
  stage.bakeEnvironment(engine.renderer);
  engine.setScene(stage.scene, preset);
  const h = (x: number, z: number) => world.height(x, z);
  let loop!: CoreLoop;
  let walker!: CoreLoop['walker'];
  let nodeViews: NodeView[] = [];
  let nodeViewById = new Map<string, NodeView>();
  let buildings = new Map<string, BuildingView>();
  let mist!: Mist;
  let growth!: GrowthLayer;
  let growthItems: GrowthItem[] = [];
  let animals: AnimalView[] = [];
  let stoneLamps: THREE.Vector4[] = [];
  let contexts: ContextTarget[] = [];
  let done = new Set<BuildingId>();
  let lvl = 0;
  let murk = 0, murkTarget = 0, heal = 0, healTarget = 0, mistTarget = 0;
  let lanternsLit = false;
  const siteShades = new Map<string, number>();

  const level = () => restoration(place, state.deposits);
  const doneAll = () => completedAll(state.siteBuilding, state.deposits);
  const buildingAt = (id: BuildingId) => { const site = loop.sites.find((s) => s.def.id === id); return site ? { site, view: buildings.get(site.id)! } : null; };
  const makeBuildings = () => {
    const m = new Map(loop.sites.map((s) => [s.id, new BuildingView(s.def, s.x, s.z, s.rot, h, partsBuilt(s.def, state.deposits[s.id]!), kitOf(save.settings.kit), loop.siteOpen(s))]));
    for (const b of m.values()) b.onTock = (at) => tock(at);
    return m;
  };
  const growthTarget = (id: string): number => {
    const g = place.growth.find((q) => q.id === id);
    if (g) return growthShown(g, lvl, done);
    const w = place.words.find((q) => q.id === id);
    return w && unlocked(w.requires, done) ? 1 : 0;
  };
  /** Re-derives everything that follows from the facts (plan 9.2), easing the world toward it. */
  const refreshRestoration = () => {
    done = doneAll();
    lvl = level();
    for (const it of growthItems) growth.setTarget(it.id, growthTarget(it.id));
    for (const s of loop.sites) buildings.get(s.id)!.open = siteOpen(s.def, done, state.deposits[s.id]);
    mistTarget = mistAmount(place, lvl);
    murkTarget = waterMurk(place, lvl);
    healTarget = lvl;
  };
  // Animal friends present from the facts (plan 4.3); one that arrives during play walks in.
  const addAnimals = (arriving: boolean) => {
    for (const a of animalsPresent(place, state.deposits)) {
      if (animals.some((d) => d.sim.def.id === a.id)) continue;
      // The crane may wade into the shallows; the deer keeps to dry ground.
      const walk = a.id === 'crane'
        ? (x: number, z: number) => Math.abs(x) < place.halfW && Math.abs(z) < place.halfH && world.height(x, z) > world.waterLevel - 0.3
        : (x: number, z: number) => world.walkable(x, z);
      const sim = new Wanderer(a, walk, place.seed + animals.length * 31, arriving);
      const v: AnimalView = a.id === 'crane' ? new CraneView(sim, h) : new DeerView(sim, characterOf(save.settings.character), h);
      animals.push(v);
      stage.scene.add(v.root);
    }
  };
  const placeActors = (): THREE.Object3D[] => [...nodeViews.map((v) => v.root), ...[...buildings.values()].map((b) => b.root), ...animals.map((d) => d.root), growth.group, mist.points];
  const actors = (): THREE.Object3D[] => [caretaker.root, fx.group, ...placeActors()];
  const addActors = () => { for (const a of actors()) stage.scene.add(a); };
  const removeActors = () => { for (const a of actors()) a.removeFromParent(); };

  // --- sitting, words and rituals (plan 3.5, 4.4): rebuilt per place, through the one proximity rule.
  let sitting: (PlaceDef['sits'])[number] | null = null;
  /** The tea ritual: seconds left kneeling at the tea set, and where to face. */
  let tea = 0, teaFace = { x: 0, z: 0 }, steamTimer = 0;
  let ritualBusy = 0;
  let ritualKind: 'chop' | 'chip' | 'deposit' = 'chop';
  const bellRing = { t: -1, x: 0, z: 0 };
  const ringAt = (x: number, z: number) => { bellRing.t = 0; bellRing.x = x; bellRing.z = z; };
  const contextOf = (o: Omit<ContextTarget, 'priority' | 'kind' | 'onEnter' | 'onTick' | 'onExit'>): ContextTarget =>
    ({ priority: PRIORITY.context, kind: 'context', onEnter: () => undefined, onTick: () => undefined, onExit: () => undefined, ...o });
  const quiet = (on: boolean) => {
    hud.style.transition = 'opacity 1.2s';
    hud.style.opacity = on ? '0.15' : '1';
    cam.sitting = on;
  };
  const sit = (spot: (PlaceDef['sits'])[number]) => {
    sitting = spot;
    walker.x = spot.x;
    walker.z = spot.z;
    walker.vx = walker.vz = 0;
    walker.heading = Math.atan2(spot.face.x - spot.x, spot.face.z - spot.z);
    quiet(true);
    audio.play('bell');
  };
  const stand = () => {
    if (!sitting) return;
    // Step off the seat: forward if there's room, else back or to a side.
    const hd = walker.heading;
    const clear = (x: number, z: number) => world.walkable(x, z) && loop.area.blockers.every((b) => Math.hypot(b.x - x, b.z - z) > b.r + 0.4);
    for (const turn of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const x = sitting.x + Math.sin(hd + turn) * 1.1, z = sitting.z + Math.cos(hd + turn) * 1.1;
      if (clear(x, z)) { walker.x = x; walker.z = z; break; }
    }
    sitting = null;
    quiet(false);
  };
  const endTea = () => { tea = 0; quiet(false); };

  // Poem stones and notes: walk up, press to read. The first read adds it to the collection (a fact).
  const wordsEl = $('words');
  let reading: string | null = null;
  const showWords = (id: string | null) => {
    reading = id;
    if (!id) { wordsEl.classList.remove('show'); return; }
    const w = WORDS[id]!;
    $('words-lines').innerHTML = w.lines.map((l) => `<div>${l.replace(/[<>&]/g, '')}</div>`).join('');
    $('words-from').textContent = w.from ? `— ${w.from}` : '';
    $('words-tag').hidden = !w.draft;
    wordsEl.classList.toggle('poem', w.kind === 'poem');
    wordsEl.classList.add('show');
    if (state.collect(id)) audio.play('page');
    else audio.play('click');
  };

  // Rituals (plan 3.5): short, unrewarded, nothing saved.
  const ritualActs: Record<RitualDef['id'], (at: THREE.Vector3, b: NonNullable<ReturnType<typeof buildingAt>>) => void> = {
    ring_bell: (at, b) => {
      b.view.ring();
      ritualKind = 'chop';
      window.setTimeout(() => { audio.play('temple_bell'); ringAt(at.x, at.z); }, 380);
    },
    rake_gravel: (_at, b) => {
      b.view.rake(RITUALS.rake_gravel.seconds);
      ritualKind = 'chip';
      for (let i = 0; i < 4; i++) window.setTimeout(() => audio.play('rake', 0.9), i * 1000);
    },
    light_lanterns: () => {
      // One after another along the path, from the hall down toward the gate.
      lanternsLit = true;
      ritualKind = 'deposit';
      const ls = growth.slotsOf('path_lantern').sort((a, b) => a.z - b.z);
      const g = growth;
      ls.forEach((l, i) => window.setTimeout(() => { if (g === growth) { g.setLit(l.id, 1); audio.play('lantern', 0.8, pentatonicRate(i)); } }, 300 + i * 650));
    },
    make_tea: (_at, b) => {
      // Kneel at the bench and make a bowl of tea: the pot is poured, steam rises, the water pipe tocks on.
      // Any move stands up early (plan 3.5: rituals are short and never hold you).
      tea = RITUALS.make_tea.seconds;
      const s = new THREE.Vector3();
      teaFace = b.view.steamAt(s) ? { x: s.x, z: s.z } : { x: b.site.x, z: b.site.z };
      walker.vx = walker.vz = 0;
      walker.heading = Math.atan2(teaFace.x - walker.x, teaFace.z - walker.z);
      quiet(true);
      window.setTimeout(() => { if (tea > 0) audio.play('pour', 0.9); }, 1400);
    },
  };

  // The travel map (plan 4.1): opens from a map board once a second place is known.
  const travelEl = $('travel');
  let mapOpen = false;
  let mapPick: PlaceId | null = null;
  const placesOnMap = () => PLACE_IDS.filter((id) => state.places.has(id));
  const drawMap = () => {
    const pins = $('travel-pins');
    pins.innerHTML = '';
    const known = placesOnMap();
    // The painted trail between known places, as a dotted line.
    const pts = known.map((id) => PLACES[id].map.at);
    $('travel-trail').setAttribute('d', pts.length > 1 ? `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}` : '');
    for (const id of known) {
      const p = PLACES[id];
      const btn = document.createElement('button');
      btn.className = 'pin' + (id === place.id ? ' here' : '') + (id === mapPick ? ' pick' : '');
      btn.style.left = `${p.map.at.x}%`;
      btn.style.top = `${(p.map.at.y / 60) * 100}%`;
      btn.innerHTML = `<span class="dot"></span><span class="name">${p.name}</span>${id === place.id ? '<span class="here-tag">you are here</span>' : ''}`;
      btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (id !== place.id) { mapPick = id; travelPick(); } });
      pins.append(btn);
    }
  };
  const showMap = (on: boolean) => {
    mapOpen = on;
    travelEl.classList.toggle('show', on);
    if (on) {
      mapPick = placesOnMap().find((id) => id !== place.id) ?? null;
      drawMap();
      audio.play('page');
    }
  };
  const travelPick = () => {
    const to = mapPick;
    showMap(false);
    if (to && to !== place.id) travel(to, PLACES[to].arrivals.map!);
  };
  $('travel-close').addEventListener('pointerdown', (e) => { e.stopPropagation(); showMap(false); });

  /** Builds the place's context targets: sit spots, words, rituals, the map board. */
  const buildContexts = () => {
    contexts = [];
    for (const spot of place.sits) {
      contexts.push(contextOf({
        id: `sit:${spot.id}`, radius: 2.1, x: spot.x, z: spot.z, label: 'Sit',
        isAvailable: () => !sitting && unlocked(spot.requires, done),
        act: () => sit(spot),
      }));
    }
    for (const w of place.words) {
      contexts.push(contextOf({
        id: `words:${w.id}`, radius: 1.9, x: w.x, z: w.z, label: 'Read',
        isAvailable: () => unlocked(w.requires, done) && growth.shown(w.id) > 0.6,
        act: () => showWords(reading === w.id ? null : w.id),
      }));
    }
    for (const r of Object.values(RITUALS)) {
      const b = buildingAt(r.building);
      if (!b) continue;
      const at = b.view.localToWorldXZ(r.at.x, r.at.z, new THREE.Vector3());
      contexts.push(contextOf({
        id: `ritual:${r.id}`, radius: r.radius, x: at.x, z: at.z, label: r.label,
        isAvailable: () => ritualBusy <= 0 && tea <= 0 && done.has(r.building) && duringTime(r.during, dayT) && !(r.id === 'light_lanterns' && lanternsLit),
        act: () => {
          ritualBusy = r.seconds;
          walker.heading = Math.atan2(b.site.x - walker.x, b.site.z - walker.z);
          ritualActs[r.id](at, b);
        },
      }));
    }
    contexts.push(contextOf({
      id: 'map', radius: 2.0, x: place.map.x + Math.sin(place.map.rot) * 1.2, z: place.map.z + Math.cos(place.map.rot) * 1.2, label: 'Map',
      isAvailable: () => mapUnlocked(state.places),
      act: () => showMap(true),
    }));
    loop.proximates.push(...contexts);
  };

  /**
   * Builds everything for a place and puts the caretaker at `at` (facing `face`). The previous place, if
   * any, is torn down first. Called at boot and on every arrival.
   */
  const enter = (id: PlaceId, at: { x: number; z: number }, face?: { x: number; z: number }, first = false) => {
    if (!first) {
      // Tear down: the stage frees its scene's geometry, so take the shared actors out first.
      caretaker.root.removeFromParent();
      fx.group.removeFromParent();
      loop.dispose();
      for (const b of buildings.values()) b.dispose();
      growth.dispose();
      mist.dispose();
      stage.dispose();
      place = PLACES[id];
      world = worldOf(id);
      preset = presetAt(place.daylight, dayT);
      stage = new Stage(world, preset, engine.quality, engine.renderer.getPixelRatio());
      stage.bakeEnvironment(engine.renderer);
      engine.setScene(stage.scene, preset);
    }
    sitting = null; tea = 0; ritualBusy = 0; lanternsLit = false; reading = null;
    showWords(null);
    quiet(false);
    loop = new CoreLoop(place, { walkable: (x, z) => world.walkable(x, z), solids: world.solids }, state, at);
    loop.onLeave = (e) => leave(e);
    walker = loop.walker;
    if (face) walker.heading = Math.atan2(face.x - at.x, face.z - at.z);
    caretaker.root.rotation.y = walker.heading;
    nodeViews = loop.nodes.map((n) => nodeView(n, h(n.x, n.z) - 0.08, place.nodes.find((q) => q.id === n.id)?.rot ?? 0));
    nodeViewById = new Map(nodeViews.map((v) => [v.node.id, v]));
    buildings = makeBuildings();
    done = doneAll();
    lvl = level();
    mistTarget = mistAmount(place, lvl);
    mist = new Mist(place.mist.puffs, h, preset.fog, mistTarget, place.seed + 41);
    growthItems = [
      ...place.growth.map((g) => ({ id: g.id, kind: g.kind, x: g.x, z: g.z, rot: g.rot ?? 0, scale: g.scale ?? 1 })),
      ...place.words.map((w) => ({ id: w.id, kind: WORDS[w.id]!.kind === 'poem' ? 'poem_stone' : 'note_post', x: w.x, z: w.z, rot: w.rot ?? 0, scale: 1 })),
    ];
    growth = new GrowthLayer(growthItems, h, growthTarget);
    murk = murkTarget = waterMurk(place, lvl);
    heal = healTarget = lvl;
    stoneLamps = rich() ? staticLamps(world) : [];
    animals = [];
    siteShades.clear();
    addActors();
    addAnimals(false);
    buildContexts();
    cam.snap();
    if (state.discover(place.id)) dirty = true;
  };

  // --- travel (plan 4.1): an exit walked into, or a place picked on the map. Fade to paper, build the next
  // place, fade back in. Saved on both sides, so a reload at any moment lands somewhere sensible.
  const fadeEl = $('fade');
  let travelling = false;
  const travel = (to: PlaceId, arrival: Arrival) => {
    if (travelling) return;
    travelling = true;
    if (sitting) stand();
    if (tea > 0) endTea();
    persist();
    audio.play('travel', 0.9);
    fadeEl.style.transition = `opacity ${FADE_OUT_MS}ms ease-in`;
    fadeEl.classList.add('show');
    window.setTimeout(() => {
      const firstTime = !state.places.has(to);
      enter(to, arrival, arrival.face);
      updateLight(0, true);
      persist();
      // Let the new place draw once before lifting the fade.
      window.setTimeout(() => {
        fadeEl.style.transition = `opacity ${FADE_IN_MS}ms ease-out`;
        fadeEl.classList.remove('show');
        window.setTimeout(() => { travelling = false; }, FADE_IN_MS * 0.5);
        const lines = firstTime ? ARRIVALS[to]?.lines : undefined;
        if (lines) showLines(lines, 900);
      }, 120);
    }, FADE_OUT_MS);
  };
  const leave = (e: ExitDef) => travel(e.to, PLACES[e.to].arrivals[e.arrive]!);

  // Lines that fade in one after another (the opening, a first arrival).
  const intro = $('intro');
  const showLines = (lines: readonly string[], delay: number) => {
    lines.forEach((line, i) => {
      window.setTimeout(() => { intro.textContent = line; intro.classList.add('show'); }, delay + i * 5200);
      window.setTimeout(() => intro.classList.remove('show'), delay + i * 5200 + 4000);
    });
  };

  // --- save: facts only (plan 9.2). Every deposit is written at once, so closing the tab mid-deposit
  // keeps exactly what was delivered; gathering is written within a second; and on hide (phones).
  const persist = () => {
    save.at = { place: place.id, x: Math.round(walker.x * 100) / 100, z: Math.round(walker.z * 100) / 100 };
    const facts = state.toFacts();
    save.satchel = facts.satchel;
    save.deposits = facts.deposits;
    save.collection = facts.collection;
    save.places = facts.places;
    writeSave(store, save);
    dirty = false;
  };

  // --- light: the place's presets along its day cycle (src/core/daylight.ts), re-baked now and then.
  let lightTimer = 0, bakeTimer = 0, bakedT = dayT;
  const updateLight = (dt: number, force = false) => {
    lightTimer += dt;
    bakeTimer += dt;
    if (!force && lightTimer < 0.1) return;
    lightTimer = 0;
    dayT = timeNow();
    preset = presetAt(place.daylight, dayT);
    stage.applyLight(preset);
    engine.setGrade(preset.grade);
    mist.setColor(preset.fog);
    const dd = Math.abs(dayT - bakedT);
    if (force || (Math.min(dd, 1 - dd) > 0.004 && bakeTimer > 0.6)) {
      stage.rebakeEnvironment(engine.renderer);
      bakedT = dayT;
      bakeTimer = 0;
    }
  };

  // The water pipe's knock: heard near the tea house, always seen (a splash).
  const tock = (at: THREE.Vector3) => {
    fx.splash(at.clone().setZ(at.z + 0.6).setY(at.y - 0.3));
    const d = Math.hypot(at.x - walker.x, at.z - walker.z);
    const vol = Math.max(0, 1 - d / 26);
    if (vol > 0.05) audio.play('tock', vol * 0.9);
  };

  // Where the game starts: the saved spot if it still stands up, else the place's way in (or the spawn).
  {
    const p = PLACES[startPlace];
    const ok = save.at.place === p.id && world.walkable(save.at.x, save.at.z);
    const at = ok ? { x: save.at.x, z: save.at.z } : p.id === 'home_valley' ? p.spawn : p.arrivals.trail ?? p.spawn;
    // At home the caretaker starts facing the camera, as before; elsewhere, facing along the way in.
    enter(p.id, at, ok || p.id === 'home_valley' ? undefined : p.arrivals.trail?.face, true);
  }

  // Quality changes rebuild the stage (grass and particle counts, terrain step), as Lanternfall does.
  const setTier = (t: QualityTier) => {
    if (t === engine.qualityId) return;
    engine.setQuality(t);
    removeActors(); // keep the loop's views out of the old stage's clean-up
    stage.dispose();
    stage = new Stage(world, preset, engine.quality, engine.renderer.getPixelRatio());
    stage.bakeEnvironment(engine.renderer);
    engine.setScene(stage.scene, preset);
    addActors();
    updateLight(0, true);
    governor.reset();
  };

  // --- HUD, context button, settings menu
  const chip = $('chip');
  const contextBtn = $('context-btn');
  contextBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.pressContext(); });
  const menu = $('menu');
  const qualitySel = $('quality') as HTMLSelectElement;
  const soundSel = $('sound') as HTMLSelectElement;
  qualitySel.value = engine.qualityId;
  soundSel.value = save.settings.sound ? 'on' : 'off';
  // Camera and caretaker size are decided (A2: camera A, A3: Medium). An older save that picked a trial
  // option that no longer exists falls back to the decided one.
  const chosenCamera = CAMERA_OPTIONS.find((o) => o.id === save.settings.camera) ?? CAMERA_OPTIONS[0]!;
  const chosenScale = SCALE_OPTIONS.find((o) => o.id === save.settings.scale) ?? SCALE_OPTIONS[0]!;
  save.settings.camera = chosenCamera.id;
  save.settings.scale = chosenScale.id;
  cam.setOption(chosenCamera.id);
  caretaker.size = chosenScale.caretaker;
  // --- Phase 2 trial settings: look (reloads), caretaker style, kit style, time of day.
  const lookSel = $('look') as HTMLSelectElement;
  const charSel = $('character') as HTMLSelectElement;
  const kitSel = $('kit') as HTMLSelectElement;
  const timeSel = $('time-mode') as HTMLSelectElement;
  const timeRange = $('time-at') as HTMLInputElement;
  const timeLabel = $('time-label');
  const fill = (sel: HTMLSelectElement, items: [string, string][]) => { sel.innerHTML = items.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); };
  ($('art-trial') as HTMLElement).hidden = !trial;
  fill(lookSel, LOOK_IDS.map((id) => [id, LOOKS[id].name]));
  fill(charSel, CHARACTER_STYLES.map((id) => [id, CARETAKER[id].name]));
  fill(kitSel, KIT_STYLES.map((id) => [id, KIT_STYLE_INFO[id].name]));
  lookSel.value = look().id;
  charSel.value = save.settings.character;
  kitSel.value = save.settings.kit;
  const showTime = () => {
    timeSel.value = save.settings.time.mode;
    timeRange.value = String(Math.round(timeNow() * 1000));
    timeRange.disabled = false;
    timeLabel.textContent = clockLabel(timeNow());
    $('look-note').textContent = look().note;
  };
  showTime();
  lookSel.addEventListener('change', () => {
    save.settings.look = lookSel.value;
    persist();
    reloadIntoLook(look().id);
  });
  charSel.addEventListener('change', () => {
    save.settings.character = characterOf(charSel.value);
    removeActors();
    caretaker.dispose();
    caretaker = new CaretakerView(characterOf(save.settings.character));
    caretaker.size = chosenScale.caretaker;
    animals = [];
    addActors();
    addAnimals(false);
    persist();
  });
  kitSel.addEventListener('change', () => {
    save.settings.kit = kitOf(kitSel.value);
    removeActors();
    for (const b of buildings.values()) b.dispose();
    buildings = makeBuildings();
    addActors();
    persist();
  });
  timeSel.addEventListener('change', () => {
    const mode = timeSel.value === 'fixed' || timeSel.value === 'day' ? timeSel.value : 'clock';
    save.settings.time = { mode, at: timeNow() };
    showTime();
    persist();
  });
  timeRange.addEventListener('input', () => {
    save.settings.time = { mode: 'fixed', at: Number(timeRange.value) / 1000 };
    showTime();
    dirty = true;
  });

  const toggleMenu = () => {
    if (mapOpen) { showMap(false); return; }
    menu.classList.toggle('show'); audio.play('click'); if (menu.classList.contains('show')) showTime();
  };
  $('menu-btn').addEventListener('click', toggleMenu);
  $('menu-close').addEventListener('click', toggleMenu);
  input.onMenu = toggleMenu;
  input.onZoom = (dir) => cam.toggleZoom(dir);
  qualitySel.addEventListener('change', () => {
    const t = qualitySel.value as QualityTier;
    save.settings.quality = t;
    setTier(t);
    persist();
  });
  soundSel.addEventListener('change', () => {
    save.settings.sound = soundSel.value === 'on';
    audio.setVolume(0.8, !save.settings.sound);
    persist();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
    audio.suspend(document.hidden);
  });
  window.addEventListener('pagehide', persist);
  let saveTimer = 0;

  // --- what the loop's events look and sound like
  const satchelEl = $('satchel');
  const carryEl: Record<MaterialId, HTMLElement> = { wood: $('carry-wood'), stone: $('carry-stone'), bamboo: $('carry-bamboo') };
  const costEl = $('cost');
  const costName = $('cost-name');
  const costItems = $('cost-items');
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  let bumpTimer = 0;
  const showSatchel = () => {
    let any = false;
    for (const m of MATERIALS) {
      const n = state.satchel[m];
      const el = carryEl[m];
      el.hidden = n === 0;
      el.classList.toggle('full', n >= SATCHEL_CAP);
      el.querySelector('b')!.textContent = String(n);
      if (n > 0) any = true;
    }
    satchelEl.classList.toggle('empty', !any);
  };
  showSatchel();
  state.on((e) => {
    if (e.type === 'gathered') {
      const view = nodeViewById.get(e.node);
      if (view) {
        view.hit();
        const at = view.burstAt(v1);
        const foot = v2.set(view.node.x, h(view.node.x, view.node.z) + (e.material === 'bamboo' ? 0.4 : 1), view.node.z);
        if (e.material === 'wood') fx.chop(at, foot, e.left === 0);
        else if (e.material === 'bamboo') fx.cut(at, foot, e.left === 0);
        else fx.chip(at);
        // One note per beat, climbing the scale through the node's units (plan 3.1).
        audio.play(e.material, 0.9, pentatonicRate(NODE_KINDS[view.node.kind].noteStep + e.unit));
      }
      caretaker.bumpBasket();
      satchelEl.classList.add('bump');
      bumpTimer = 0.15;
      dirty = true;
    } else if (e.type === 'deposited') {
      const b = buildings.get(e.site);
      if (b) {
        const flight = BEAT_SECONDS * 0.8;
        caretaker.basketTop(v1);
        b.partCenter(e.part, v2);
        b.addPart(e.part, flight);
        const step = e.part;
        const at = v2.clone();
        fx.fly(e.material, v1, v2, flight, () => {
          audio.play('place', 0.8);
          audio.play(e.material, 0.7, pentatonicRate(step - 3));
          fx.settle(at);
        });
      }
      persist();
    } else if (e.type === 'completed') {
      const site = loop.sites.find((s) => s.id === e.site);
      if (site) {
        const at = new THREE.Vector3(site.x, h(site.x, site.z) + 1.5, site.z);
        const wasOpen = new Set(loop.sites.filter((s) => buildings.get(s.id)!.open).map((s) => s.id));
        const here = place;
        window.setTimeout(() => {
          if (place !== here) return; // travelled away meanwhile: the next place derives it all on entry
          audio.play('bell');
          ringAt(site.x, site.z);
          fx.complete(at);
          cam.celebrate(at);
          refreshRestoration();
          addAnimals(true);
          // Then the next site gently reveals itself (plan 3.3), with a chime and a soft settle of dust.
          for (const s of loop.sites) {
            if (wasOpen.has(s.id) || !buildings.get(s.id)!.open) continue;
            window.setTimeout(() => { audio.play('reveal'); fx.settle(new THREE.Vector3(s.x, h(s.x, s.z) + 0.3, s.z)); }, 2600);
          }
        }, BEAT_SECONDS * 1000 + 300);
      }
      persist();
    } else if (e.type === 'collected' || e.type === 'discovered') {
      dirty = true;
    }
    showSatchel();
  });
  const showCost = (siteId: string | null) => {
    const site = siteId ? loop.sites.find((s) => s.id === siteId) : undefined;
    for (const b of buildings.values()) b.active = false;
    if (!site) { costEl.classList.remove('show'); return; }
    buildings.get(site.id)!.active = true;
    const need = remaining(site.def, state.deposits[site.id]!);
    costName.textContent = site.def.name;
    costItems.innerHTML = '';
    for (const m of MATERIALS) {
      if (need[m] <= 0) continue;
      const item = carryEl[m].cloneNode(true) as HTMLElement;
      item.removeAttribute('id');
      item.hidden = false;
      item.classList.remove('full');
      item.querySelector('b')!.textContent = String(need[m]);
      costItems.append(item);
    }
    v1.set(site.x, h(site.x, site.z) + 3.8, site.z).project(engine.camera);
    costEl.style.left = `${(v1.x * 0.5 + 0.5) * window.innerWidth}px`;
    costEl.style.top = `${(-v1.y * 0.5 + 0.5) * window.innerHeight}px`;
    costEl.classList.add('show');
  };

  // The opening (plan 4.4, 4.5): chapter 1 begins at the old gate, a few lines one after another, once.
  if (!save.opened) {
    showLines(OPENING.lines, 900);
    save.opened = true;
    persist();
  }
  void firstVisit;

  // --- graphics context loss (Lanternfall's handling): pause, rebake the sky light, carry on.
  let gfxLost = false;
  let gfxTimer = 0;
  const canvas = engine.renderer.domElement;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // without this the browser never offers the context back
    if (gfxLost) return;
    gfxLost = true;
    persist();
    audio.suspend(true);
    chip.textContent = 'Waiting for the graphics to come back…';
    clearTimeout(gfxTimer);
    gfxTimer = window.setTimeout(() => { chip.textContent = 'Graphics lost. Reload the page to continue.'; }, GFX_RESTORE_WAIT_MS);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(gfxTimer);
    stage.rebakeEnvironment(engine.renderer);
    governor.reset();
    gfxLost = false;
    last = performance.now();
    audio.suspend(document.hidden);
  });

  // --- main loop, paced like Lanternfall's: smoothed frame times and an automatic resolution governor
  const smoother = new FrameSmoother();
  const governor = new ResolutionGovernor();
  const debug = $('debug');
  const focus = new THREE.Vector3();
  const focus2 = new THREE.Vector3();
  let last = performance.now();
  let time = 0;
  let sitK = 0, ambTimer = 0;
  const lampPool = Array.from({ length: 32 }, () => new THREE.Vector4());
  let fpsFrames = 0, fpsTime = 0, fps = 0;
  let mapMoveWas = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const rawDt = (now - last) / 1000;
    last = now;
    if (!(rawDt > 0) || gfxLost) return;
    const dt = smoother.next(rawDt);
    time += dt;
    shared.uTime.value = time;

    const intent = input.poll();
    const moving = Math.hypot(intent.move.x, intent.move.z) > 0.05;
    let target: Proximate | null = null;
    ritualBusy = Math.max(0, ritualBusy - dt);
    if (mapOpen) {
      // On the map: left/right picks a place, the context action travels there.
      const known = placesOnMap().filter((id) => id !== place.id);
      const dir = Math.abs(intent.move.x) > 0.5 ? Math.sign(intent.move.x) : 0;
      if (dir !== 0 && dir !== mapMoveWas && known.length) {
        const i = Math.max(0, known.indexOf(mapPick as PlaceId));
        mapPick = known[(i + dir + known.length) % known.length]!;
        drawMap();
        audio.play('click');
      }
      mapMoveWas = dir;
      if (intent.contextPressed) travelPick();
      contextBtn.classList.remove('show');
      chip.textContent = '';
    } else if (travelling) {
      contextBtn.classList.remove('show');
      chip.textContent = '';
    } else if (sitting && (moving || intent.contextPressed)) stand();
    else if (tea > 0 && (moving || intent.contextPressed)) endTea();
    else if (!menu.classList.contains('show')) {
      target = loop.step(dt, intent.move, !sitting && tea <= 0);
      const showCtx = !!target && target.kind === 'context';
      contextBtn.classList.toggle('show', showCtx && input.lastKind === 'touch');
      contextBtn.textContent = target?.label ?? '';
      chip.textContent = showCtx
        ? input.lastKind === 'touch' ? `Tap ${target!.label}` : input.lastKind === 'gamepad' ? `Ⓐ ${target!.label}` : `E · ${target!.label}`
        : '';
      if (intent.contextPressed && target && target.kind === 'context') (target as ContextTarget).act();
    }
    // Words close when the caretaker walks away from them.
    if (reading && target?.id !== `words:${reading}` && !travelling) showWords(null);
    // The path lanterns go out at dawn, ready to be lit again at dusk. Where no one lights them by hand
    // (the grove has no hall), they light themselves at dusk once restored.
    const night = duringTime(RITUALS.light_lanterns.during, dayT);
    if (!buildingAt('meditation_hall')) {
      if (night !== lanternsLit) { lanternsLit = night; for (const l of growth.slotsOf('path_lantern')) growth.setLit(l.id, night ? 1 : 0); }
    } else if (lanternsLit && !night) {
      lanternsLit = false;
      for (const l of growth.slotsOf('path_lantern')) growth.setLit(l.id, 0);
    }
    if (sitting || tea > 0) { contextBtn.classList.remove('show'); chip.textContent = ''; }
    showCost(target && target.priority === PRIORITY.buildSite ? target.id.slice('site:'.length) : null);
    if (bumpTimer > 0 && (bumpTimer -= dt) <= 0) satchelEl.classList.remove('bump');
    // The tea ritual: kneeling, steam curling up from the bowl.
    if (tea > 0) {
      tea -= dt;
      if (tea <= 0) endTea();
      steamTimer -= dt;
      const tb = buildingAt('tea_house');
      if (steamTimer <= 0 && tb && tb.view.steamAt(v1)) { fx.steam(v1); steamTimer = 0.22; }
    }

    const y = world.height(walker.x, walker.z);
    const ritualWork = ritualBusy > 0 && tea <= 0 ? { kind: ritualKind, phase: (time * 1.6) % 1 } : null;
    caretaker.update(dt, walker.x, y + (sitting ? sitting.seat : 0), walker.z, walker.heading, walker.speed, state.satchel, ritualWork ?? loop.work, !!sitting || tea > 0);
    caretaker.root.updateMatrixWorld();
    caretaker.chest(focus2);
    shared.uFocus.value.set(focus2.x, focus2.y, focus2.z, 1);
    for (const d of animals) { d.sim.update(dt, { x: walker.x, z: walker.z, speed: walker.speed, sitting: !!sitting || tea > 0 }); d.update(dt); }
    growth.update(dt);
    murk += (murkTarget - murk) * (1 - Math.exp(-dt * 0.35));
    heal += (healTarget - heal) * (1 - Math.exp(-dt * 0.3));
    stage.setWaterMurk(murk);
    stage.setHeal(0.35 + 0.65 * heal);
    sitK += ((sitting || tea > 0 ? 1 : 0) - sitK) * (1 - Math.exp(-dt * 0.4));
    ambTimer += dt;
    if (ambTimer > 0.5) { ambTimer = 0; audio.setAmbience(ambienceMix(dayT, lvl, sitK, place.id === 'bamboo_grove' ? 'grove' : 'valley')); }
    // The bell's sound, seen: a soft ring spreading over the ground (the game reads with sound off).
    if (bellRing.t >= 0) {
      bellRing.t += dt;
      const k = bellRing.t / 3.2;
      (stage.uniforms.uRing2!.value as THREE.Vector4).set(bellRing.x, bellRing.z, 1 + k * 14, Math.max(0, 0.55 * (1 - k)));
      if (k >= 1) bellRing.t = -1;
    }
    updateLight(dt);
    focus.set(walker.x, y, walker.z);
    cam.update(dt, focus, walker.vx, walker.vz);
    for (const v of nodeViews) {
      // The ring fades in from 7 m and out again once the caretaker is working the node.
      const d = Math.hypot(v.node.x - walker.x, v.node.z - walker.z);
      v.hint = Math.max(0, Math.min(1, (7 - d) / 3)) * (d < v.node.def.radius ? 0.3 : 1);
      v.update(dt, time);
    }
    for (const b of buildings.values()) b.update(dt, time);
    for (const [id, b] of buildings) siteShades.set(id, b.groundShade);
    stage.setSiteShades(siteShades);
    if (rich()) {
      // Lanternfall+: the light slots go to the lanterns nearest the caretaker: stone lanterns, the
      // buildings' lanterns, and the path lanterns once lit.
      let n = 0;
      for (const l of stoneLamps) if (n < lampPool.length) lampPool[n++]!.copy(l);
      for (const b of buildings.values()) n += b.lamps(lampPool, n);
      for (const l of growth.slotsOf('path_lantern')) if (n < lampPool.length) lampPool[n++]!.set(l.x, l.y + 1.12, l.z, l.lit * l.shown);
      const lit = lampPool.slice(0, n).filter((v) => v.w > 0.01).sort((a, b) => Math.hypot(a.x - walker.x, a.z - walker.z) - Math.hypot(b.x - walker.x, b.z - walker.z));
      for (let k = 0; k < LAMPS; k++) { const v = lit[k]; if (v) shared.uLamps.value[k]!.copy(v); else shared.uLamps.value[k]!.w = 0; }
    }
    const pixelScale = engine.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(engine.camera.fov) / 2));
    mist.update(dt, mistTarget, pixelScale);
    stage.setFogDensity(stage.baseFog * (1 + (place.mist.fogBoost - 1) * mist.amount));
    fx.update(dt, time, pixelScale);
    stage.update(time);
    engine.render(dt, time);

    const scale = governor.sample(dt, engine.renderScale, walker.speed < 0.1);
    if (scale !== null) engine.setRenderScale(scale);
    saveTimer += dt;
    if (!travelling && ((saveTimer > 5 && walker.speed > 0.1) || (dirty && saveTimer > 1))) { saveTimer = 0; persist(); }
    fpsFrames++;
    fpsTime += rawDt;
    if (fpsTime >= 0.5) {
      fps = Math.round(fpsFrames / fpsTime);
      fpsFrames = 0;
      fpsTime = 0;
      debug.textContent = `${fps} fps · ${engine.qualityId}${engine.renderScale < 1 ? ` · ${Math.round(engine.renderScale * 100)}%` : ''}`;
    }
  };
  requestAnimationFrame(frame);

  /** Screenshots: rebuild the building views and re-derive the world from the facts (no events). */
  const rebuildFromFacts = () => {
    removeActors();
    for (const b of buildings.values()) b.dispose();
    buildings = makeBuildings();
    animals = [];
    addActors();
    refreshRestoration();
    addAnimals(false);
    contexts.forEach((c) => { const i = loop.proximates.indexOf(c); if (i >= 0) loop.proximates.splice(i, 1); });
    buildContexts();
  };

  // A tiny handle for the browser smoke test and for poking at things in devtools.
  (window as unknown as { __mb: unknown }).__mb = {
    get fps() { return fps; },
    get pos() { return { x: walker.x, z: walker.z }; },
    get speed() { return walker.speed; },
    get tier() { return engine.qualityId; },
    get sitting() { return !!sitting; },
    get level() { return lvl; },
    get open() { return loop.sites.filter((s) => loop.siteOpen(s)).map((s) => s.id); },
    get done() { return [...done]; },
    get collection() { return [...state.collection]; },
    get context() { return loop.sensor.current?.kind === 'context' ? loop.sensor.current.id : null; },
    /** Phase 4: where the caretaker is, which places are known, whether the map is open, and travel. */
    get place() { return place.id; },
    get places() { return [...state.places].sort(); },
    get travelling() { return travelling; },
    get mapOpen() { return mapOpen; },
    get tea() { return tea > 0; },
    /** Smoke tests: press the context button. */
    pressContext() { input.pressContext(); },
    get satchel() { return { ...state.satchel }; },
    get deposits() { return state.toFacts().deposits; },
    get nodes() { return loop.nodes.map((n) => ({ id: n.id, kind: n.kind, units: n.units, phase: n.phase, x: n.x, z: n.z })); },
    get work() { return loop.work?.kind ?? null; },
    get mist() { return mist.amount; },
    get look() { return look().id; },
    get time() { return dayT; },
    get deer() { return animals.map((d) => ({ id: d.sim.def.id, x: d.sim.x, z: d.sim.z, act: d.sim.act })); },
    /** Screenshots: fix the time of day (a fraction, or a named moment). */
    setTime(t: number | keyof typeof MOMENTS) {
      save.settings.time = { mode: 'fixed', at: typeof t === 'number' ? t : MOMENTS[t] };
      updateLight(0, true);
    },
    /** Screenshots: a close camera on the caretaker, turned three-quarters, with the animals beside them. */
    closeup(heading = 0.5, distance = 4.6, height = 2.9, lookLift = 0.8) {
      cam.option = { ...cam.option, zooms: [{ distance, height, lookAhead: 0 }, cam.option.zooms[1]] };
      cam.lookLift = lookLift;
      walker.heading = heading;
      caretaker.root.rotation.y = heading;
      for (const d of animals) { d.sim.x = walker.x - 1.6; d.sim.z = walker.z - 0.6; d.sim.heading = 1.2; }
    },
    setCharacter(id: string) { charSel.value = id; charSel.dispatchEvent(new Event('change')); },
    setKit(id: string) { kitSel.value = id; kitSel.dispatchEvent(new Event('change')); },
    /**
     * Screenshots: put facts in place as if delivered (rebuilds the views; no events). Counts are whole
     * parts as modelled (plan 9.6's numbers), turned into units of pieces (pacing pass, 2026-11-11).
     */
    deliver(site: string, wood: number, stone = 0, bamboo = 0) {
      const d = state.deposits[site];
      const b = BUILDINGS[site as BuildingId];
      if (!d || !b) return;
      d.wood = unitsForOldParts(b, 'wood', wood); d.stone = unitsForOldParts(b, 'stone', stone); d.bamboo = unitsForOldParts(b, 'bamboo', bamboo);
      rebuildFromFacts();
    },
    /** Screenshots: put raw units in place (pieces, not whole parts), to show a part half assembled. */
    deliverUnits(site: string, wood: number, stone = 0, bamboo = 0) {
      const d = state.deposits[site];
      if (!d) return;
      d.wood = wood; d.stone = stone; d.bamboo = bamboo;
      rebuildFromFacts();
    },
    /** Screenshots: settle the easing (software GL runs at a few fps) so the world shows its settled state. */
    settle() {
      growth.snap();
      murk = murkTarget; heal = healTarget;
      mist.amount = mistTarget;
      for (const b of buildings.values()) b.update(10, time);
    },
    /** Screenshots: run a ritual now, wherever the caretaker is. */
    ritual(id: RitualDef['id']) { contexts.find((c) => c.id === `ritual:${id}`)?.act(); },
    /** Screenshots: read words / sit at a spot / open the map. */
    read(id: string) { showWords(id); },
    sitAt(id: string) { const sp = place.sits.find((q) => q.id === id); if (sp) sit(sp); },
    openMap() { showMap(true); },
    /** Screenshots: every building in every place complete (or none), as facts. */
    restoreAll(on = true) {
      for (const p of allPlaces) for (const s of p.sites) {
        const c = state.deposits[s.id]!;
        const cost = buildingCost(BUILDINGS[s.building]);
        for (const m of MATERIALS) c[m] = on ? cost[m] ?? 0 : 0;
      }
      rebuildFromFacts();
    },
    /** Smoke tests and screenshots: travel now (as by the map), or mark a place found. */
    travel(id: string) { if (isPlace(id)) travel(id, PLACES[id].arrivals.map!); },
    discover(id: string) { state.discover(id); },
    /** Smoke tests and screenshots: put the caretaker somewhere. */
    teleport(x: number, z: number) { walker.x = x; walker.z = z; walker.vx = walker.vz = 0; },
    zoom(dir: 1 | -1) { cam.toggleZoom(dir); },
    renderer: engine.renderer,
  };
}

try {
  boot();
} catch (e) {
  console.error(e);
  showBootError(String(e instanceof Error ? e.stack ?? e.message : e));
}
