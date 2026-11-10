// Moss & Bell — Phase 0 entry point: the first home island, a placeholder caretaker, follow camera,
// one move vector + one context action, quality tiers, and a versioned save.

import * as THREE from 'three';
import { Audio } from './audio/audio';
import { browserStore, loadSave, writeSave, type SaveData } from './core/save';
import { PLACES } from './data/places';
import { PRESETS } from './data/presets';
import { defaultTier, QUALITY, type QualityTier } from './data/quality';
import { validateData } from './data/validate';
import { CaretakerView } from './render/caretaker';
import { FollowCamera } from './render/camera';
import { Engine } from './render/engine';
import { buildStage } from './render/stage';
import { Petals } from './render/vfx';
import { blockersFor, scatterPlace } from './sim/layout';
import { PRIORITY, ProximitySensor, type Proximate } from './sim/proximity';
import { Walker } from './sim/walker';
import { InputController } from './ui/input';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function showBootError(msg: string): void {
  const el = $('boot-error');
  el.textContent = `Moss & Bell could not start.\n\n${msg}`;
  el.style.display = 'block';
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

  const nav = navigator as Navigator & { deviceMemory?: number };
  const autoTier = defaultTier({
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    screenMinSide: Math.min(screen.width, screen.height),
  });
  const tierFromSave = (s: SaveData): QualityTier => (s.settings.quality === 'auto' ? autoTier : s.settings.quality);

  const place = PLACES.home_valley;
  const preset = PRESETS[place.preset]!;
  let engine: Engine;
  try {
    engine = new Engine($('game') as HTMLCanvasElement, tierFromSave(save));
  } catch (e) {
    showBootError(`WebGL is not available in this browser.\n${String(e)}`);
    return;
  }
  engine.applyPreset(preset);

  const scattered = scatterPlace(place);
  const stage = buildStage(place, preset, scattered, engine.q);
  engine.scene.add(stage.group);
  const area = { boundsRadius: place.islandRadius - 1, blockers: blockersFor(place, scattered) };

  const walker = new Walker(save.at.place === place.id ? save.at.x : place.spawn.x, save.at.place === place.id ? save.at.z : place.spawn.z);
  const caretaker = new CaretakerView(place.palette);
  engine.scene.add(caretaker.root);
  const cam = new FollowCamera(engine.camera);
  let petals = new Petals(engine.q.particles, place.palette.cherry);
  engine.scene.add(petals.points);
  engine.onTierChange((t) => {
    stage.rebuildGrass(QUALITY[t]);
    engine.scene.remove(petals.points);
    petals.dispose();
    petals = new Petals(QUALITY[t].particles, place.palette.cherry);
    engine.scene.add(petals.points);
  });

  const audio = new Audio(save.settings.sound);
  const input = new InputController($('game'), $('stick'), $('knob'));

  // --- sit spot: the one context interactable in Phase 0, wired through the proximity rule.
  let sitting = false;
  const hud = $('hud');
  const benchDef = place.props.find((p) => p.kind === 'bench')!;
  const sitSpot: Proximate = {
    id: `sit:${benchDef.id}`,
    priority: PRIORITY.context,
    radius: 1.9,
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
    walker.z = benchDef.z + 0.05;
    walker.vx = walker.vz = 0;
    walker.heading = (benchDef.rot ?? 0) + Math.PI; // face the pond
    hud.style.transition = 'opacity 1.2s';
    hud.style.opacity = '0.15';
    audio.bell(0);
  };
  const stand = () => {
    sitting = false;
    walker.z = benchDef.z + 0.9;
    hud.style.opacity = '1';
  };

  // --- HUD, context button, settings menu
  const chip = $('chip');
  const contextBtn = $('context-btn');
  contextBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.pressContext(); });
  const menu = $('menu');
  const qualitySel = $('quality') as HTMLSelectElement;
  const soundSel = $('sound') as HTMLSelectElement;
  qualitySel.value = engine.tier;
  soundSel.value = save.settings.sound ? 'on' : 'off';
  const toggleMenu = () => menu.classList.toggle('show');
  $('menu-btn').addEventListener('click', toggleMenu);
  $('menu-close').addEventListener('click', toggleMenu);
  input.onMenu = toggleMenu;
  input.onZoom = (dir) => cam.toggleZoom(dir);
  qualitySel.addEventListener('change', () => {
    const t = qualitySel.value as QualityTier;
    save.settings.quality = t;
    engine.setTier(t);
    persist();
  });
  soundSel.addEventListener('change', () => {
    save.settings.sound = soundSel.value === 'on';
    audio.setEnabled(save.settings.sound);
    persist();
  });

  // --- save: position + settings; on hide (important on phones) and every few seconds while walking
  const persist = () => {
    save.at = { place: place.id, x: Math.round(walker.x * 100) / 100, z: Math.round(walker.z * 100) / 100 };
    writeSave(store, save);
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
  window.addEventListener('pagehide', persist);
  let saveTimer = 0;

  // --- main loop
  const debug = $('debug');
  const focus = new THREE.Vector3();
  let last = performance.now();
  let fpsFrames = 0, fpsTime = 0, fps = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const time = now / 1000;
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
        : sitting ? '' : place.name;
      if (intent.contextPressed && target === sitSpot) sit();
    }
    if (sitting) { contextBtn.classList.remove('show'); chip.textContent = ''; }

    const y = stage.heightAt(walker.x, walker.z);
    caretaker.update(dt, walker.x, y + (sitting ? 0.25 : 0), walker.z, walker.heading, walker.speed);
    focus.set(walker.x, y, walker.z);
    cam.update(dt, focus, walker.vx, walker.vz);
    stage.update(time, focus);
    petals.update(dt, time, focus);
    engine.render(time);

    saveTimer += dt;
    if (saveTimer > 5 && walker.speed > 0.1) { saveTimer = 0; persist(); }
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; debug.textContent = `${fps} fps · ${engine.tier}`; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // A tiny handle for the browser smoke test and for poking at things in devtools.
  (window as unknown as { __mb: unknown }).__mb = {
    get fps() { return fps; },
    get pos() { return { x: walker.x, z: walker.z }; },
    get tier() { return engine.tier; },
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
