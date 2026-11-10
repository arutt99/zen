// Moss & Bell — Phase 0 entry point: the first home island on Lanternfall's engine, a placeholder
// caretaker, follow camera, one move vector + one context action, quality tiers, and a versioned save.

import * as THREE from 'three';
import { audio } from './audio/audio';
import { FrameSmoother, ResolutionGovernor } from './core/pacing';
import { browserStore, loadSave, writeSave, type SaveData } from './core/save';
import { PLACES } from './data/places';
import { PRESETS } from './data/presets';
import { defaultTier, type QualityTier } from './data/quality';
import { validateData } from './data/validate';
import { FollowCamera } from './render/camera';
import { CaretakerView } from './render/caretaker';
import { Engine } from './render/engine';
import { initMaterials, shared } from './render/materials';
import { Stage } from './render/stage';
import { IslandWorld } from './sim/island';
import { PRIORITY, ProximitySensor, type Proximate } from './sim/proximity';
import { Walker } from './sim/walker';
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
  const preset = PRESETS[place.preset]!;
  const world = new IslandWorld(place);
  let stage = new Stage(world, preset, engine.quality, engine.renderer.getPixelRatio());
  stage.bakeEnvironment(engine.renderer);
  engine.setScene(stage.scene, preset);
  const area = { walkable: (x: number, z: number) => world.walkable(x, z), blockers: world.solids };

  const startOk = save.at.place === place.id && world.walkable(save.at.x, save.at.z);
  const walker = new Walker(startOk ? save.at.x : place.spawn.x, startOk ? save.at.z : place.spawn.z);
  const caretaker = new CaretakerView();
  const cam = new FollowCamera(engine.camera);
  const addActors = () => stage.scene.add(caretaker.root);
  addActors();

  // Quality changes rebuild the stage (grass and particle counts, terrain step), as Lanternfall does.
  const setTier = (t: QualityTier) => {
    if (t === engine.qualityId) return;
    engine.setQuality(t);
    stage.dispose();
    stage = new Stage(world, preset, engine.quality, engine.renderer.getPixelRatio());
    stage.bakeEnvironment(engine.renderer);
    engine.setScene(stage.scene, preset);
    addActors();
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
  const proximates: Proximate[] = [sitSpot];
  const sensor = new ProximitySensor();
  const sit = () => {
    sitting = true;
    walker.x = benchDef.x;
    walker.z = benchDef.z;
    walker.vx = walker.vz = 0;
    walker.heading = Math.atan2(place.pond.x - benchDef.x, place.pond.z - benchDef.z); // face the pond
    hud.style.transition = 'opacity 1.2s';
    hud.style.opacity = '0.15';
    audio.play('bell');
  };
  const stand = () => {
    sitting = false;
    // Step off the bench, away from the pond.
    const away = Math.atan2(benchDef.x - place.pond.x, benchDef.z - place.pond.z);
    walker.x = benchDef.x + Math.sin(away) * 1.2;
    walker.z = benchDef.z + Math.cos(away) * 1.2;
    hud.style.opacity = '1';
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
  const toggleMenu = () => { menu.classList.toggle('show'); audio.play('click'); };
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

  // --- save: position + settings; on hide (important on phones) and every few seconds while walking
  const persist = () => {
    save.at = { place: place.id, x: Math.round(walker.x * 100) / 100, z: Math.round(walker.z * 100) / 100 };
    writeSave(store, save);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
    audio.suspend(document.hidden);
  });
  window.addEventListener('pagehide', persist);
  let saveTimer = 0;

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
    if (sitting && (moving || intent.contextPressed)) stand();
    else if (!menu.classList.contains('show')) {
      if (!sitting) walker.step(dt, intent.move, area);
      const target = sensor.update(walker.x, walker.z, proximates, dt);
      const showCtx = !!target && target.kind === 'context';
      contextBtn.classList.toggle('show', showCtx && input.lastKind === 'touch');
      contextBtn.textContent = target?.label ?? '';
      chip.textContent = showCtx
        ? input.lastKind === 'touch' ? `Tap ${target!.label}` : input.lastKind === 'gamepad' ? `Ⓐ ${target!.label}` : `E · ${target!.label}`
        : place.name;
      if (intent.contextPressed && target === sitSpot) sit();
    }
    if (sitting) { contextBtn.classList.remove('show'); chip.textContent = ''; }

    const y = world.height(walker.x, walker.z);
    caretaker.update(dt, walker.x, y + (sitting ? 0.2 : 0), walker.z, walker.heading, walker.speed);
    focus.set(walker.x, y, walker.z);
    cam.update(dt, focus, walker.vx, walker.vz);
    stage.update(time);
    engine.render(dt, time);

    const scale = governor.sample(dt, engine.renderScale, walker.speed < 0.1);
    if (scale !== null) engine.setRenderScale(scale);
    saveTimer += dt;
    if (saveTimer > 5 && walker.speed > 0.1) { saveTimer = 0; persist(); }
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
    renderer: engine.renderer,
  };
}

try {
  boot();
} catch (e) {
  console.error(e);
  showBootError(String(e instanceof Error ? e.stack ?? e.message : e));
}
