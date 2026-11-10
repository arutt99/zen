// Moss & Bell — entry point. Phase 1: the home island on Lanternfall's engine, the core loop (gather on
// the beat → carry → deposit → watch it grow → the mist lifts), the HUD, and the save. Phase 2: the look
// (A6), the caretaker and deer (A4), building kits (A5), the time of day and the canopy fade. Phase 3:
// the whole home valley — four buildings that reveal themselves in turn, the restoration layer, sit
// spots, rituals (bell, rake, lanterns at dusk), poem stones and caretaker notes, the opening at the
// gate, and ambience by time of day.
// Game rules run in src/sim (CoreLoop); this file only wires them to rendering, sound and the page.

import * as THREE from 'three';
import { audio, pentatonicRate } from './audio/audio';
import { ambienceMix } from './audio/ambience-mix';
import { GrowthLayer, type GrowthItem } from './render/growth';
import { staticLamps } from './render/rich';
import { duringTime, RITUALS, type RitualDef } from './data/rituals';
import { OPENING, WORDS } from './data/words';
import { FrameSmoother, ResolutionGovernor } from './core/pacing';
import { browserStore, loadSave, writeSave, type SaveData } from './core/save';
import { BEAT_SECONDS, MATERIALS, NODE_KINDS, SATCHEL_CAP } from './data/gathering';
import { CAMERA_OPTIONS, SCALE_OPTIONS } from './data/feel';
import { PLACES } from './data/places';
import { CHARACTER_STYLES, CARETAKER, type CharacterStyleId } from './data/characters';
import { KIT_STYLES, KIT_STYLE_INFO, type BuildingId, type KitStyleId } from './data/buildings';
import { LOOKS, LOOK_IDS } from './data/looks';
import { MOMENTS } from './data/presets';
import { clockLabel, presetAt, timeOfDay } from './core/daylight';
import { DeerView } from './render/deer';
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
import { nodeView } from './render/nodes';
import { Stage } from './render/stage';
import { IslandWorld } from './sim/island';
import { CoreLoop } from './sim/loop';
import { animalsPresent, completedBuildings, growthShown, mistAmount, partsBuilt, remaining, restoration, siteOpen, unlocked, waterMurk } from './sim/progress';
import { PRIORITY, type Proximate } from './sim/proximity';
import { GameState } from './sim/state';
import { InputController } from './ui/input';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** How long to wait for the graphics to come back before offering a reload (Lanternfall's value). */
const GFX_RESTORE_WAIT_MS = 6000;

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

  const place = PLACES.home_valley;
  // Time of day: blended from the place's presets along its day cycle (src/core/daylight.ts).
  const timeNow = () => timeOfDay(save.settings.time, new Date());
  let dayT = timeNow();
  let preset = presetAt(place.daylight, dayT);
  const world = new IslandWorld(place);
  let stage = new Stage(world, preset, engine.quality, engine.renderer.getPixelRatio());
  stage.bakeEnvironment(engine.renderer);
  engine.setScene(stage.scene, preset);
  const firstVisit = save.at.place === '';

  // --- the core loop: facts from the save, rules from src/sim
  const state = new GameState(Object.values(PLACES), save);
  const startOk = save.at.place === place.id && world.walkable(save.at.x, save.at.z);
  const loop = new CoreLoop(place, { walkable: (x, z) => world.walkable(x, z), solids: world.solids }, state, startOk ? save.at : place.spawn);
  const walker = loop.walker;
  const h = (x: number, z: number) => world.height(x, z);

  // --- views of the loop
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
  const nodeViews = loop.nodes.map((n) => nodeView(n, h(n.x, n.z) - 0.08, place.nodes.find((q) => q.id === n.id)?.rot ?? 0));
  const nodeViewById = new Map(nodeViews.map((v) => [v.node.id, v]));
  const makeBuildings = () => new Map(loop.sites.map((s) => [s.id, new BuildingView(s.def, s.x, s.z, s.rot, h, partsBuilt(s.def, state.deposits[s.id]!), kitOf(save.settings.kit), loop.siteOpen(s))]));
  let buildings = makeBuildings();
  const level = () => restoration(place, state.deposits);
  const buildingAt = (id: BuildingId) => { const site = loop.sites.find((s) => s.def.id === id); return site ? { site, view: buildings.get(site.id)! } : null; };
  const mist = new Mist(place.mist.puffs, h, preset.fog, mistAmount(place, level()), place.seed + 41);

  // --- the restoration layer (plan 3.4): props, poem stones and notes that come and go with the facts.
  let done = completedBuildings(place, state.deposits);
  let lvl = level();
  const growthItems: GrowthItem[] = [
    ...place.growth.map((g) => ({ id: g.id, kind: g.kind, x: g.x, z: g.z, rot: g.rot ?? 0, scale: g.scale ?? 1 })),
    ...place.words.map((w) => ({ id: w.id, kind: WORDS[w.id]!.kind === 'poem' ? 'poem_stone' : 'note_post', x: w.x, z: w.z, rot: w.rot ?? 0, scale: 1 })),
  ];
  const growthTarget = (id: string): number => {
    const g = place.growth.find((q) => q.id === id);
    if (g) return growthShown(g, lvl);
    const w = place.words.find((q) => q.id === id);
    return w && unlocked(w.requires, done) ? 1 : 0;
  };
  const growth = new GrowthLayer(growthItems, h, growthTarget);
  let murk = waterMurk(place, lvl), murkTarget = murk;
  let heal = lvl, healTarget = lvl;
  /** Re-derives everything that follows from the facts (plan 9.2), easing the world toward it. */
  const refreshRestoration = () => {
    done = completedBuildings(place, state.deposits);
    lvl = level();
    for (const it of growthItems) growth.setTarget(it.id, growthTarget(it.id));
    for (const s of loop.sites) buildings.get(s.id)!.open = siteOpen(s.def, done, state.deposits[s.id]);
    mistTarget = mistAmount(place, lvl);
    murkTarget = waterMurk(place, lvl);
    healTarget = lvl;
  };
  const stoneLamps = rich() ? staticLamps(world) : [];
  let lightTimer = 0, bakeTimer = 0, bakedT = dayT;
  /** Re-blends the time of day (cheap), and re-bakes the sky light now and then (not every frame). */
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
  let mistTarget = mist.amount;
  const fx = new Fx(engine.quality.ambient > 0.6 ? 900 : 500);
  // Animal friends present from the facts (plan 4.3); one that arrives during play walks in.
  const deer: DeerView[] = [];
  const addAnimals = (arriving: boolean) => {
    for (const a of animalsPresent(place, state.deposits)) {
      if (deer.some((d) => d.sim.def.id === a.id)) continue;
      const sim = new Wanderer(a, (x, z) => world.walkable(x, z), place.seed + deer.length * 31, arriving);
      const v = new DeerView(sim, characterOf(save.settings.character), h);
      deer.push(v);
      stage.scene.add(v.root);
    }
  };
  const actors = (): THREE.Object3D[] => [caretaker.root, ...nodeViews.map((v) => v.root), ...[...buildings.values()].map((b) => b.root), ...deer.map((d) => d.root), growth.group, mist.points, fx.group];
  const addActors = () => { for (const a of actors()) stage.scene.add(a); };
  const removeActors = () => { for (const a of actors()) a.removeFromParent(); };
  addActors();
  addAnimals(false);

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

  const input = new InputController($('game'), $('stick'), $('knob'));
  audio.setVolume(0.8, !save.settings.sound);
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });

  // --- context interactables (plan 3.5, 4.4), all through the one proximity rule: sit spots, poem
  // stones and notes, and rituals. Each shows the context button; pressing it calls `act`.
  type ContextTarget = Proximate & { act(): void };
  const contexts: ContextTarget[] = [];
  const hud = $('hud');
  const contextOf = (o: Omit<ContextTarget, 'priority' | 'kind' | 'onEnter' | 'onTick' | 'onExit'>): ContextTarget =>
    ({ priority: PRIORITY.context, kind: 'context', onEnter: () => undefined, onTick: () => undefined, onExit: () => undefined, ...o });

  // Sit spots: the bench, and one more with each of the shelter, the garden and the hall.
  let sitting: (typeof place.sits)[number] | null = null;
  for (const spot of place.sits) {
    contexts.push(contextOf({
      id: `sit:${spot.id}`, radius: 2.1, x: spot.x, z: spot.z, label: 'Sit',
      isAvailable: () => !sitting && unlocked(spot.requires, done),
      act: () => sit(spot),
    }));
  }
  const sit = (spot: (typeof place.sits)[number]) => {
    sitting = spot;
    walker.x = spot.x;
    walker.z = spot.z;
    walker.vx = walker.vz = 0;
    walker.heading = Math.atan2(spot.face.x - spot.x, spot.face.z - spot.z);
    hud.style.transition = 'opacity 1.2s';
    hud.style.opacity = '0.15';
    cam.sitting = true;
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
    hud.style.opacity = '1';
    cam.sitting = false;
  };

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
  for (const w of place.words) {
    contexts.push(contextOf({
      id: `words:${w.id}`, radius: 1.9, x: w.x, z: w.z, label: 'Read',
      isAvailable: () => unlocked(w.requires, done) && growth.shown(w.id) > 0.6,
      act: () => showWords(reading === w.id ? null : w.id),
    }));
  }

  // Rituals (plan 3.5): short, unrewarded, nothing saved.
  let ritualBusy = 0;
  let ritualKind: 'chop' | 'chip' | 'deposit' = 'chop';
  let lanternsLit = false;
  const bellRing = { t: -1, x: 0, z: 0 };
  const ringAt = (x: number, z: number) => { bellRing.t = 0; bellRing.x = x; bellRing.z = z; };
  const ritualActs: Record<RitualDef['id'], (at: THREE.Vector3) => void> = {
    ring_bell: (at) => {
      const tower = buildingAt('bell_tower')!;
      tower.view.ring();
      ritualKind = 'chop';
      window.setTimeout(() => { audio.play('temple_bell'); ringAt(at.x, at.z); }, 380);
    },
    rake_gravel: () => {
      const garden = buildingAt('gravel_garden')!;
      garden.view.rake(RITUALS.rake_gravel.seconds);
      ritualKind = 'chip';
      for (let i = 0; i < 4; i++) window.setTimeout(() => audio.play('rake', 0.9), i * 1000);
    },
    light_lanterns: () => {
      // One after another along the path, from the hall down toward the gate.
      lanternsLit = true;
      ritualKind = 'deposit';
      const ls = growth.slotsOf('path_lantern').sort((a, b) => a.z - b.z);
      ls.forEach((l, i) => window.setTimeout(() => { growth.setLit(l.id, 1); audio.play('lantern', 0.8, pentatonicRate(i)); }, 300 + i * 650));
    },
  };
  for (const r of Object.values(RITUALS)) {
    const b = buildingAt(r.building);
    if (!b) continue;
    const at = b.view.localToWorldXZ(r.at.x, r.at.z, new THREE.Vector3());
    contexts.push(contextOf({
      id: `ritual:${r.id}`, radius: r.radius, x: at.x, z: at.z, label: r.label,
      isAvailable: () => ritualBusy <= 0 && done.has(r.building) && duringTime(r.during, dayT) && !(r.id === 'light_lanterns' && lanternsLit),
      act: () => {
        ritualBusy = r.seconds;
        walker.heading = Math.atan2(b.site.x - walker.x, b.site.z - walker.z);
        ritualActs[r.id](at);
      },
    }));
  }
  loop.proximates.push(...contexts);

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
    for (const d of deer.splice(0)) d.root.removeFromParent();
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

  const toggleMenu = () => { menu.classList.toggle('show'); audio.play('click'); if (menu.classList.contains('show')) showTime(); };
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

  // --- save: facts only (plan 9.2). Every deposit is written at once, so closing the tab mid-deposit
  // keeps exactly what was delivered; gathering is written within a second; and on hide (phones).
  let dirty = false;
  const persist = () => {
    save.at = { place: place.id, x: Math.round(walker.x * 100) / 100, z: Math.round(walker.z * 100) / 100 };
    const facts = state.toFacts();
    save.satchel = facts.satchel;
    save.deposits = facts.deposits;
    save.collection = facts.collection;
    writeSave(store, save);
    dirty = false;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
    audio.suspend(document.hidden);
  });
  window.addEventListener('pagehide', persist);
  let saveTimer = 0;

  // --- what the loop's events look and sound like
  const satchelEl = $('satchel');
  const carryEl = { wood: $('carry-wood'), stone: $('carry-stone') };
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
      const view = nodeViewById.get(e.node)!;
      view.hit();
      const at = view.burstAt(v1);
      if (e.material === 'wood') fx.chop(at, v2.set(view.node.x, h(view.node.x, view.node.z) + 1, view.node.z), e.left === 0);
      else fx.chip(at);
      // One note per beat, climbing the scale through the node's units (plan 3.1).
      audio.play(e.material, 0.9, pentatonicRate(NODE_KINDS[view.node.kind].noteStep + e.unit));
      caretaker.bumpBasket();
      satchelEl.classList.add('bump');
      bumpTimer = 0.15;
      dirty = true;
    } else if (e.type === 'deposited') {
      const b = buildings.get(e.site)!;
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
      persist();
    } else if (e.type === 'completed') {
      const site = loop.sites.find((s) => s.id === e.site)!;
      const at = new THREE.Vector3(site.x, h(site.x, site.z) + 1.5, site.z);
      const wasOpen = new Set(loop.sites.filter((s) => buildings.get(s.id)!.open).map((s) => s.id));
      window.setTimeout(() => {
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
      persist();
    } else if (e.type === 'collected') {
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
  const intro = $('intro');
  if (!save.opened) {
    OPENING.lines.forEach((line, i) => {
      window.setTimeout(() => { intro.textContent = line; intro.classList.add('show'); }, 900 + i * 5200);
      window.setTimeout(() => intro.classList.remove('show'), 900 + i * 5200 + 4000);
    });
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
  const siteShades = new Map<string, number>();
  const lampPool = Array.from({ length: 32 }, () => new THREE.Vector4());
  let fpsFrames = 0, fpsTime = 0, fps = 0;
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
    if (sitting && (moving || intent.contextPressed)) stand();
    else if (!menu.classList.contains('show')) {
      target = loop.step(dt, intent.move, !sitting);
      const showCtx = !!target && target.kind === 'context';
      contextBtn.classList.toggle('show', showCtx && input.lastKind === 'touch');
      contextBtn.textContent = target?.label ?? '';
      chip.textContent = showCtx
        ? input.lastKind === 'touch' ? `Tap ${target!.label}` : input.lastKind === 'gamepad' ? `Ⓐ ${target!.label}` : `E · ${target!.label}`
        : '';
      if (intent.contextPressed && target && target.kind === 'context') (target as ContextTarget).act();
    }
    // Words close when the caretaker walks away from them.
    if (reading && target?.id !== `words:${reading}`) showWords(null);
    // The path lanterns go out at dawn, ready to be lit again at dusk.
    if (lanternsLit && !duringTime(RITUALS.light_lanterns.during, dayT)) {
      lanternsLit = false;
      for (const l of growth.slotsOf('path_lantern')) growth.setLit(l.id, 0);
    }
    if (sitting) { contextBtn.classList.remove('show'); chip.textContent = ''; }
    showCost(target && target.priority === PRIORITY.buildSite ? target.id.slice('site:'.length) : null);
    if (bumpTimer > 0 && (bumpTimer -= dt) <= 0) satchelEl.classList.remove('bump');

    const y = world.height(walker.x, walker.z);
    const ritualWork = ritualBusy > 0 ? { kind: ritualKind, phase: (time * 1.6) % 1 } : null;
    caretaker.update(dt, walker.x, y + (sitting ? sitting.seat : 0), walker.z, walker.heading, walker.speed, state.satchel, ritualWork ?? loop.work, !!sitting);
    caretaker.root.updateMatrixWorld();
    caretaker.chest(focus2);
    shared.uFocus.value.set(focus2.x, focus2.y, focus2.z, 1);
    for (const d of deer) { d.sim.update(dt, { x: walker.x, z: walker.z, speed: walker.speed, sitting: !!sitting }); d.update(dt); }
    growth.update(dt);
    murk += (murkTarget - murk) * (1 - Math.exp(-dt * 0.35));
    heal += (healTarget - heal) * (1 - Math.exp(-dt * 0.3));
    stage.setWaterMurk(murk);
    stage.setHeal(0.35 + 0.65 * heal);
    sitK += ((sitting ? 1 : 0) - sitK) * (1 - Math.exp(-dt * 0.4));
    ambTimer += dt;
    if (ambTimer > 0.5) { ambTimer = 0; audio.setAmbience(ambienceMix(dayT, lvl, sitK)); }
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
      for (const l of stoneLamps) lampPool[n++]!.copy(l);
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
    if ((saveTimer > 5 && walker.speed > 0.1) || (dirty && saveTimer > 1)) { saveTimer = 0; persist(); }
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
    /** Smoke tests: press the context button. */
    pressContext() { input.pressContext(); },
    get satchel() { return { ...state.satchel }; },
    get deposits() { return state.toFacts().deposits; },
    get nodes() { return loop.nodes.map((n) => ({ id: n.id, units: n.units, phase: n.phase, x: n.x, z: n.z })); },
    get work() { return loop.work?.kind ?? null; },
    get mist() { return mist.amount; },
    get look() { return look().id; },
    get time() { return dayT; },
    get deer() { return deer.map((d) => ({ x: d.sim.x, z: d.sim.z, act: d.sim.act })); },
    /** Screenshots: fix the time of day (a fraction, or a named moment). */
    setTime(t: number | keyof typeof MOMENTS) {
      save.settings.time = { mode: 'fixed', at: typeof t === 'number' ? t : MOMENTS[t] };
      updateLight(0, true);
    },
    /** Screenshots: a close camera on the caretaker, turned three-quarters, with the deer beside them. */
    closeup(heading = 0.5, distance = 4.6, height = 2.9, lookLift = 0.8) {
      cam.option = { ...cam.option, zooms: [{ distance, height, lookAhead: 0 }, cam.option.zooms[1]] };
      cam.lookLift = lookLift;
      walker.heading = heading;
      caretaker.root.rotation.y = heading;
      for (const d of deer) { d.sim.x = walker.x - 1.6; d.sim.z = walker.z - 0.6; d.sim.heading = 1.2; }
    },
    setCharacter(id: string) { charSel.value = id; charSel.dispatchEvent(new Event('change')); },
    setKit(id: string) { kitSel.value = id; kitSel.dispatchEvent(new Event('change')); },
    /** Screenshots: put facts in place as if delivered (rebuilds the views; no events). */
    deliver(site: string, wood: number, stone = 0) {
      state.deposits[site]!.wood = wood;
      state.deposits[site]!.stone = stone;
      removeActors();
      for (const b of buildings.values()) b.dispose();
      buildings = makeBuildings();
      addActors();
      refreshRestoration();
      addAnimals(false);
    },
    /** Screenshots: skip the easing (software GL runs at a few fps) so the world shows its settled state. */
    settle() {
      growth.snap();
      murk = murkTarget; heal = healTarget;
      mist.amount = mistTarget;
      for (const b of buildings.values()) b.update(10, time);
    },
    /** Screenshots: run a ritual now, wherever the caretaker is. */
    ritual(id: RitualDef['id']) { contexts.find((c) => c.id === `ritual:${id}`)?.act(); },
    /** Screenshots: read words / sit at a spot. */
    read(id: string) { showWords(id); },
    sitAt(id: string) { const sp = place.sits.find((q) => q.id === id); if (sp) sit(sp); },
    /** Screenshots: every building complete (or none), as facts. */
    restoreAll(on = true) {
      for (const s of loop.sites) { const c = s.def.parts; state.deposits[s.id]!.wood = on ? c.filter((p) => p.material === 'wood').length : 0; state.deposits[s.id]!.stone = on ? c.filter((p) => p.material === 'stone').length : 0; }
      removeActors();
      for (const b of buildings.values()) b.dispose();
      buildings = makeBuildings();
      addActors();
      refreshRestoration();
      addAnimals(false);
    },
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
