// Moss & Bell — entry point. Phase 1: the home island on Lanternfall's engine, the core loop (gather on
// the beat → carry → deposit → watch it grow → the mist lifts), the HUD, and the save. Phase 2: the look
// presets (A6), the caretaker and deer in two proportion styles (A4), building kit styles (A5), the
// time of day from the clock with a debug slider, and the canopy fade.
// Game rules run in src/sim (CoreLoop); this file only wires them to rendering, sound and the page.

import * as THREE from 'three';
import { audio, pentatonicRate } from './audio/audio';
import { FrameSmoother, ResolutionGovernor } from './core/pacing';
import { browserStore, loadSave, writeSave, type SaveData } from './core/save';
import { BEAT_SECONDS, MATERIALS, NODE_KINDS, SATCHEL_CAP } from './data/gathering';
import { CAMERA_OPTIONS, SCALE_OPTIONS } from './data/feel';
import { PLACES } from './data/places';
import { CHARACTER_STYLES, CARETAKER, type CharacterStyleId } from './data/characters';
import { KIT_STYLES, KIT_STYLE_INFO, type KitStyleId } from './data/buildings';
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
import { animalsPresent, mistAmount, partsBuilt, remaining, restoration } from './sim/progress';
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
  save.settings.look = useLook(save.settings.look).id;

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
  const kitOf = (id: string): KitStyleId => (KIT_STYLES as readonly string[]).includes(id) ? id as KitStyleId : 'temple';
  save.settings.character = characterOf(save.settings.character);
  save.settings.kit = kitOf(save.settings.kit);
  let caretaker = new CaretakerView(characterOf(save.settings.character));
  const cam = new FollowCamera(engine.camera);
  const nodeViews = loop.nodes.map((n) => nodeView(n, h(n.x, n.z) - 0.08, place.nodes.find((q) => q.id === n.id)?.rot ?? 0));
  const nodeViewById = new Map(nodeViews.map((v) => [v.node.id, v]));
  const makeBuildings = () => new Map(loop.sites.map((s) => [s.id, new BuildingView(s.def, s.x, s.z, s.rot, h, partsBuilt(s.def, state.deposits[s.id]!), kitOf(save.settings.kit))]));
  let buildings = makeBuildings();
  const level = () => restoration(place, state.deposits);
  const mist = new Mist(place.mist.puffs, h, preset.fog, mistAmount(place, level()), place.seed + 41);
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
  const actors = (): THREE.Object3D[] => [caretaker.root, ...nodeViews.map((v) => v.root), ...[...buildings.values()].map((b) => b.root), ...deer.map((d) => d.root), mist.points, fx.group];
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

  // --- sit spot: the one context interactable in Phase 0, wired through the proximity rule.
  let sitting = false;
  const hud = $('hud');
  const benchDef = place.props.find((p) => p.kind === 'bench')!;
  const sitSpot: Proximate = {
    id: `sit:${benchDef.id}`,
    priority: PRIORITY.context,
    radius: 2.1,
    x: benchDef.x,
    z: benchDef.z,
    kind: 'context',
    label: 'Sit',
    isAvailable: () => !sitting,
    onEnter: () => undefined,
    onTick: () => undefined,
    onExit: () => undefined,
  };
  loop.proximates.push(sitSpot);
  const sit = () => {
    sitting = true;
    walker.x = benchDef.x;
    walker.z = benchDef.z;
    walker.vx = walker.vz = 0;
    walker.heading = Math.atan2(place.pond.x - benchDef.x, place.pond.z - benchDef.z); // face the pond
    hud.style.transition = 'opacity 1.2s';
    hud.style.opacity = '0.15';
    cam.sitting = true;
    audio.play('bell');
  };
  const stand = () => {
    sitting = false;
    // Step off the bench, away from the pond.
    const away = Math.atan2(benchDef.x - place.pond.x, benchDef.z - place.pond.z);
    walker.x = benchDef.x + Math.sin(away) * 1.2;
    walker.z = benchDef.z + Math.cos(away) * 1.2;
    hud.style.opacity = '1';
    cam.sitting = false;
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
    save.settings.time = { mode: timeSel.value === 'fixed' ? 'fixed' : 'clock', at: timeNow() };
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
      window.setTimeout(() => {
        audio.play('bell');
        fx.complete(at);
        cam.celebrate(at);
        mistTarget = mistAmount(place, level());
        addAnimals(true);
      }, BEAT_SECONDS * 1000 + 300);
      persist();
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

  // The opening line (plan 4.4), only on a first visit.
  const intro = $('intro');
  if (firstVisit) {
    window.setTimeout(() => intro.classList.add('show'), 800);
    window.setTimeout(() => intro.classList.remove('show'), 6500);
  }

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
    if (sitting && (moving || intent.contextPressed)) stand();
    else if (!menu.classList.contains('show')) {
      target = loop.step(dt, intent.move, !sitting);
      const showCtx = !!target && target.kind === 'context';
      contextBtn.classList.toggle('show', showCtx && input.lastKind === 'touch');
      contextBtn.textContent = target?.label ?? '';
      chip.textContent = showCtx
        ? input.lastKind === 'touch' ? `Tap ${target!.label}` : input.lastKind === 'gamepad' ? `Ⓐ ${target!.label}` : `E · ${target!.label}`
        : '';
      if (intent.contextPressed && target === sitSpot) sit();
    }
    if (sitting) { contextBtn.classList.remove('show'); chip.textContent = ''; }
    showCost(target && target.priority === PRIORITY.buildSite ? target.id.slice('site:'.length) : null);
    if (bumpTimer > 0 && (bumpTimer -= dt) <= 0) satchelEl.classList.remove('bump');

    const y = world.height(walker.x, walker.z);
    caretaker.update(dt, walker.x, y + (sitting ? 0.2 : 0), walker.z, walker.heading, walker.speed, state.satchel, loop.work, sitting);
    caretaker.root.updateMatrixWorld();
    caretaker.chest(focus2);
    shared.uFocus.value.set(focus2.x, focus2.y, focus2.z, 1);
    for (const d of deer) { d.sim.update(dt, { x: walker.x, z: walker.z, speed: walker.speed }); d.update(dt); }
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
    stage.setSiteShade(Math.max(0, ...[...buildings.values()].map((b) => b.groundShade)));
    if (rich()) {
      // Lanternfall+: the stone lanterns hold the first light slots; hanging lanterns on buildings take the rest.
      let k = stage.lampCount;
      for (const b of buildings.values()) k += b.lamps(shared.uLamps.value, k);
      for (; k < LAMPS; k++) shared.uLamps.value[k]!.w = 0;
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
    get sitting() { return sitting; },
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
    deliver(site: string, wood: number) {
      state.deposits[site]!.wood = wood;
      removeActors();
      for (const b of buildings.values()) b.dispose();
      buildings = makeBuildings();
      addActors();
      mistTarget = mistAmount(place, level());
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
