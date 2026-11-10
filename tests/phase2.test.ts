// Phase 2: looks, time of day, animals and the Zen kit data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendPresets, clockLabel, dayFraction, inkRef, lightLevel, presetAt, timeOfDay } from '../src/core/daylight';
import { ANIMALS } from '../src/data/animals';
import { CARETAKER, CARETAKER_HEIGHT, CHARACTER_STYLES, caretakerHeight } from '../src/data/characters';
import { LOOKS, LOOK_IDS, lookById } from '../src/data/looks';
import { PLACES } from '../src/data/places';
import { MOMENTS, PRESETS } from '../src/data/presets';
import { Wanderer } from '../src/sim/animals';
import { IslandWorld } from '../src/sim/island';
import { animalsPresent } from '../src/sim/progress';

const place = PLACES.home_valley;

test('look presets: painted (the target), painted+, lanternfall-like and the woodblock wildcard', () => {
  assert.deepEqual([...LOOK_IDS], ['painted', 'paintedplus', 'lanternfall', 'woodblock']);
  assert.equal(lookById('nonsense').id, 'painted');
  // Painted applies the plan 7.1 checklist: softer bands, warm light shadows, more brush, brown thin lines
  // on figures and buildings only, warmer and less saturated, paper grain, more haze.
  const p = LOOKS.painted, l = LOOKS.lanternfall;
  assert.ok(p.shading.softness > l.shading.softness * 3);
  assert.ok(p.shading.shadowTint[0] >= p.shading.shadowTint[2], 'warm shadow tint');
  assert.ok(p.shading.levels[0] > l.shading.levels[0], 'lighter shadows');
  assert.ok(p.brush > l.brush);
  assert.ok(p.outline.width < l.outline.width);
  assert.deepEqual([...p.outline.on].sort(), ['building', 'figure']);
  assert.ok(p.outline.color[0] > p.outline.color[2] && p.outline.color[0] > 0.2, 'warm brown lines');
  assert.ok(p.post.sat < 1 && p.post.grain > 0 && p.haze.density > 1);
  assert.equal(p.ground.pathInk, 0, 'no ink on the ground');
});

test('the clock gives a fraction of the day; a fixed time wins', () => {
  assert.equal(dayFraction(new Date(2026, 0, 1, 12, 0, 0)), 0.5);
  assert.equal(dayFraction(new Date(2026, 0, 1, 6, 0, 0)), 0.25);
  assert.equal(timeOfDay({ mode: 'fixed', at: 0.8 }, new Date(2026, 0, 1, 12)), 0.8);
  assert.equal(timeOfDay({ mode: 'clock', at: 0.8 }, new Date(2026, 0, 1, 18)), 0.75);
  assert.equal(clockLabel(0.26), '06:14');
  assert.equal(clockLabel(0.999999), '00:00');
});

test('presets blend smoothly through the day and wrap around midnight', () => {
  const day = presetAt('home', MOMENTS.day);
  assert.equal(day.id, 'home_day');
  assert.equal(day.sunColor, PRESETS.home_day!.sunColor);
  assert.equal(presetAt('home', 0.02).id, 'home_night');
  assert.equal(presetAt('home', 0.98).sunColor, PRESETS.home_night!.sunColor);
  // No jumps: sample the whole day; sun intensity changes by a small amount per minute.
  let prev = presetAt('home', 0).sunI;
  for (let i = 1; i <= 1440; i++) {
    const p = presetAt('home', i / 1440);
    assert.ok(Math.abs(p.sunI - prev) < 0.05, `jump at minute ${i}`);
    assert.ok(Math.abs(Math.hypot(...p.sunDir) - 1) < 1e-6);
    prev = p.sunI;
  }
  const half = blendPresets(PRESETS.home_day!, PRESETS.home_night!, 0.5);
  assert.ok(half.sunI < PRESETS.home_day!.sunI && half.sunI > PRESETS.home_night!.sunI);
});

test('night is dimmer than day but never dark, and fireflies and lanterns come out', () => {
  const day = presetAt('home', MOMENTS.day), night = presetAt('home', MOMENTS.night), dusk = presetAt('home', MOMENTS.dusk);
  assert.equal(lightLevel(day), 1);
  assert.ok(lightLevel(night) < lightLevel(dusk) && lightLevel(dusk) < 1);
  assert.ok(lightLevel(night) > 0.55, `night light ${lightLevel(night)}`);
  assert.ok(night.fireflies > day.fireflies && night.glow > day.glow && night.stars > day.stars);
  assert.ok(Number.isFinite(inkRef(night)) && inkRef(night) > inkRef(day));
});

test('both caretaker styles stand ~1.8 m tall (A3), the chibi with a much bigger head', () => {
  for (const s of CHARACTER_STYLES) assert.ok(Math.abs(caretakerHeight(CARETAKER[s]) - CARETAKER_HEIGHT) < 0.08, s);
  const headsTall = (s: 'chibi' | 'storybook') => CARETAKER_HEIGHT / (CARETAKER[s].head * 2);
  assert.ok(headsTall('chibi') < 3, `chibi ${headsTall('chibi')}`);
  assert.ok(headsTall('storybook') > 4, `storybook ${headsTall('storybook')}`);
});

test('the deer arrives with restoration, wanders near home, and steps away from a moving caretaker', () => {
  assert.equal(animalsPresent(place, { shelter: { wood: 3, stone: 0 } }).length, 0);
  assert.deepEqual(animalsPresent(place, { shelter: { wood: 6, stone: 0 } }).map((a) => a.id), ['deer']);
  const world = new IslandWorld(place);
  const walk = (x: number, z: number) => world.walkable(x, z);
  const d = new Wanderer(ANIMALS.deer, walk, 5, true);
  const home = ANIMALS.deer.home;
  const far = { x: 20, z: 15, speed: 0 };
  for (let i = 0; i < 60 * 120; i++) {
    d.update(1 / 60, far);
    assert.ok(walk(d.x, d.z), `deer on unwalkable ground at ${d.x}, ${d.z}`);
  }
  assert.ok(Math.hypot(d.x - home.x, d.z - home.z) < home.r + 0.5, 'reached home');
  const acts = new Set<string>();
  for (let i = 0; i < 60 * 120; i++) { d.update(1 / 60, far); acts.add(d.act); }
  assert.ok(acts.has('walk') && (acts.has('graze') || acts.has('rest')), [...acts].join());
  // A caretaker walking right up to a grazing deer makes it amble off.
  while (d.act === 'walk') d.update(1 / 60, far);
  const near = { x: d.x + 1, z: d.z, speed: 3 };
  d.update(1 / 60, near);
  assert.equal(d.act, 'walk');
});

test('every Zen-kit prop is placed on the valley floor (lotus on the water), clear of nodes and the site', () => {
  const world = new IslandWorld(place);
  const kinds = new Set(place.props.map((p) => p.kind));
  for (const k of ['maple', 'bamboo', 'mossy_stone', 'stone_lantern', 'fence_wood', 'fence_rope', 'raked_gravel', 'stepping_stone', 'lotus']) assert.ok(kinds.has(k), k);
  for (const p of place.props) {
    const h = world.height(p.x, p.z);
    if (p.kind === 'lotus') assert.ok(h < world.waterLevel - 0.1, `${p.id} should be in the pond`);
    for (const n of place.nodes) assert.ok(Math.hypot(n.x - p.x, n.z - p.z) > 2.2, `${p.id} crowds ${n.id}`);
    for (const s of place.sites) assert.ok(Math.hypot(s.x - p.x, s.z - p.z) > 3.4, `${p.id} sits on site ${s.id}`);
  }
});
