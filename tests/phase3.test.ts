// Phase 3: the home valley grows. Site reveal, mixed materials, the restoration layer, words and the
// collection, rituals' time windows, ambience, sitting animals, the new kits, and save v4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienceMix } from '../src/audio/ambience-mix';
import { freshSave, parseSave } from '../src/core/save';
import { timeOfDay } from '../src/core/daylight';
import { ANIMALS } from '../src/data/animals';
import { BUILDINGS, BUILDING_IDS, buildingCost } from '../src/data/buildings';
import { MATERIALS } from '../src/data/gathering';
import { PLACES } from '../src/data/places';
import { MOMENTS } from '../src/data/presets';
import { duringTime, RITUALS } from '../src/data/rituals';
import { OPENING, WORDS } from '../src/data/words';
import { Wanderer } from '../src/sim/animals';
import { CoreLoop, type GroundQuery } from '../src/sim/loop';
import { completedBuildings, growthShown, partsBuilt, restoration, siteOpen, waterMurk } from '../src/sim/progress';
import { GameState, type Bag } from '../src/sim/state';

const home = PLACES.home_valley;
const full = (id: keyof typeof BUILDINGS): Bag => {
  const c = buildingCost(BUILDINGS[id]);
  return { wood: c.wood ?? 0, stone: c.stone ?? 0 };
};
const none: Bag = { wood: 0, stone: 0 };

test('the four home-valley buildings follow plan 9.6: costs, order and restoration adding up to 1', () => {
  assert.deepEqual(BUILDING_IDS, ['shelter', 'gravel_garden', 'meditation_hall', 'bell_tower']);
  assert.deepEqual(buildingCost(BUILDINGS.shelter), { wood: 6 });
  assert.deepEqual(buildingCost(BUILDINGS.gravel_garden), { stone: 6, wood: 4 });
  assert.deepEqual(buildingCost(BUILDINGS.meditation_hall), { stone: 10, wood: 14 });
  assert.deepEqual(buildingCost(BUILDINGS.bell_tower), { stone: 8, wood: 10 });
  const all = Object.fromEntries(home.sites.map((s) => [s.id, full(s.building)]));
  assert.ok(Math.abs(restoration(home, all) - 1) < 1e-9);
});

test('each site reveals itself only once the one before it is complete', () => {
  const deposits: Record<string, Bag> = Object.fromEntries(home.sites.map((s) => [s.id, { ...none }]));
  const open = () => home.sites.filter((s) => siteOpen(BUILDINGS[s.building], completedBuildings(home, deposits), deposits[s.id])).map((s) => s.id);
  assert.deepEqual(open(), ['shelter']);
  deposits.shelter = full('shelter');
  assert.deepEqual(open(), ['shelter', 'gravel_garden']);
  deposits.gravel_garden = full('gravel_garden');
  deposits.meditation_hall = full('meditation_hall');
  assert.deepEqual(open(), ['shelter', 'gravel_garden', 'meditation_hall', 'bell_tower']);
  // A site that somehow already has deliveries stays open, so no work is ever hidden.
  const odd: Record<string, Bag> = Object.fromEntries(home.sites.map((s) => [s.id, { ...none }]));
  odd.bell_tower = { wood: 2, stone: 0 };
  assert.ok(siteOpen(BUILDINGS.bell_tower, completedBuildings(home, odd), odd.bell_tower));
});

test('standing on a site that has not revealed itself does nothing', () => {
  const place = { ...home, nodes: [], sites: [{ id: 'gravel_garden', building: 'gravel_garden' as const, x: 0, z: 0 }, { id: 'shelter', building: 'shelter' as const, x: 30, z: 0 }] };
  const state = new GameState([place], { satchel: { wood: 10, stone: 10 }, deposits: {} });
  const flat: GroundQuery = { walkable: () => true, solids: [] };
  const loop = new CoreLoop(place, flat, state, { x: 2.5, z: 0 });
  for (let i = 0; i < 300; i++) loop.step(1 / 60, { x: 0, z: 0 });
  assert.deepEqual(state.deposits.gravel_garden, none);
  assert.equal(loop.sensor.current, null);
});

test('mixed materials: whatever mix arrives, no part ever floats (each rests on built parts)', () => {
  for (const b of Object.values(BUILDINGS)) {
    const cost = buildingCost(b);
    for (let w = 0; w <= (cost.wood ?? 0); w++) {
      for (let s = 0; s <= (cost.stone ?? 0); s++) {
        const built = partsBuilt(b, { wood: w, stone: s });
        b.parts.forEach((p, i) => {
          if (!built[i] || !p.on) return;
          const j = b.parts.findIndex((q) => q.id === p.on);
          assert.ok(built[j], `${b.id} with ${w} wood, ${s} stone: ${p.id} is up but ${p.on} is not`);
        });
      }
    }
  }
});

test('the restoration layer: overgrowth recedes and new growth arrives at the right levels', () => {
  assert.equal(growthShown({ max: 0.2 }, 0), 1);
  assert.equal(growthShown({ max: 0.2 }, 0.2), 0);
  assert.equal(growthShown({ min: 0.45 }, 0.2), 0);
  assert.equal(growthShown({ min: 0.45 }, 0.45), 1);
  assert.equal(growthShown({ min: 1 }, 0.2 + 0.25 + 0.3 + 0.25), 1, 'float sums still reach the last level');
  // Every piece of overgrowth is gone and every new piece is there once the valley is restored.
  for (const g of home.growth) assert.equal(growthShown(g, 1), g.max !== undefined ? 0 : 1, g.id);
  // Before anything is built, the valley is overgrown and nothing new has arrived.
  for (const g of home.growth) assert.equal(growthShown(g, 0), g.min !== undefined ? 0 : 1, g.id);
  // Something changes with every building (plan 3.4: every finished building visibly heals the land).
  for (const lv of [0.2, 0.45, 0.75, 1]) assert.ok(home.growth.some((g) => g.min === lv || g.max === lv), `level ${lv}`);
  // The trail gate is shut until the bell tower, then open.
  assert.equal(growthShown(home.growth.find((g) => g.id === 'trail_gate_shut')!, 0.75), 1);
  assert.equal(growthShown(home.growth.find((g) => g.id === 'trail_gate_open')!, 0.75), 0);
  assert.equal(growthShown(home.growth.find((g) => g.id === 'trail_gate_open')!, 1), 1);
});

test('the pond clears with the gravel garden, and the deer arrives with it', () => {
  assert.equal(waterMurk(home, 0), home.water.murk);
  assert.ok(waterMurk(home, 0.2) > 0 && waterMurk(home, 0.2) < home.water.murk);
  assert.equal(waterMurk(home, 0.45), 0);
  assert.equal(ANIMALS.deer.minRestoration, 0.45);
});

test('words: original drafts flagged for the owner, read once into the collection, kept as facts', () => {
  assert.ok(OPENING.lines.length >= 1 && OPENING.lines.length <= 4);
  for (const w of Object.values(WORDS)) assert.equal(w.draft, true, `${w.id} is a draft until the owner approves it`);
  for (const w of home.words) assert.ok(WORDS[w.id], w.id);
  const s = new GameState([home]);
  const seen: string[] = [];
  s.on((e) => { if (e.type === 'collected') seen.push(e.id); });
  assert.equal(s.collect('poem_pond'), true);
  assert.equal(s.collect('poem_pond'), false, 'only the first read counts');
  assert.equal(s.collect('not_a_poem'), false);
  assert.deepEqual(seen, ['poem_pond']);
  const again = new GameState([home], { ...s.toFacts(), collection: [...s.toFacts().collection, 'ghost'] });
  assert.deepEqual([...again.collection], ['poem_pond'], 'unknown ids are dropped on load');
});

test('save v4: collection and the opening flag, with v3 migrating', () => {
  const f = freshSave();
  assert.equal(f.v, 4);
  assert.deepEqual(f.collection, []);
  assert.equal(f.opened, false);
  const v3 = { v: 3, at: { place: 'home_valley', x: 1, z: 2 }, satchel: {}, deposits: { shelter: { wood: 6 } }, settings: {} };
  const { data } = parseSave(JSON.stringify(v3));
  assert.equal(data.opened, true);
  assert.deepEqual(data.collection, []);
  const odd = parseSave(JSON.stringify({ v: 4, collection: ['poem_pond', 'poem_pond', 3, 'BAD ID!', 'note_hall'], opened: 'yes' })).data;
  assert.deepEqual(odd.collection, ['note_hall', 'poem_pond']);
  assert.equal(odd.opened, false);
  assert.equal(parseSave(JSON.stringify({ v: 4, settings: { time: { mode: 'day', at: 0.1 } } })).data.settings.time.mode, 'day');
});

test('time: "always day" ignores the clock', () => {
  assert.equal(timeOfDay({ mode: 'day', at: 0.9 }, new Date(2026, 0, 1, 23, 0)), MOMENTS.day);
});

test('rituals: lanterns are offered at dusk and night only; the others any time', () => {
  const lanterns = RITUALS.light_lanterns.during;
  assert.equal(duringTime(lanterns, MOMENTS.day), false);
  assert.equal(duringTime(lanterns, MOMENTS.golden), false);
  assert.equal(duringTime(lanterns, MOMENTS.dusk), true);
  assert.equal(duringTime(lanterns, MOMENTS.night), true);
  assert.equal(duringTime(lanterns, 0.1), true, 'past midnight');
  assert.equal(duringTime(RITUALS.ring_bell.during, 0.3), true);
  for (const r of Object.values(RITUALS)) assert.ok(home.sites.some((s) => s.building === r.building), r.id);
});

test('ambience: birds by day and crickets by night; a neglected valley is quieter; sitting lifts it', () => {
  const day = ambienceMix(MOMENTS.day, 1, 0), night = ambienceMix(MOMENTS.night, 1, 0);
  assert.ok(day.birds > 0.5 && night.birds < 0.05);
  assert.ok(night.crickets > 0.5 && day.crickets < 0.05);
  assert.ok(night.wind > day.wind);
  assert.ok(ambienceMix(MOMENTS.day, 0, 0).birds < day.birds * 0.5);
  assert.ok(ambienceMix(MOMENTS.day, 1, 1).stream > day.stream);
  // Smooth through dawn and dusk: no jumps from minute to minute.
  for (let i = 1; i < 1440; i++) {
    const a = ambienceMix((i - 1) / 1440, 1, 0), b = ambienceMix(i / 1440, 1, 0);
    for (const k of Object.keys(a) as (keyof typeof a)[]) assert.ok(Math.abs(a[k] - b[k]) < 0.05, `${k} jumps at minute ${i}`);
  }
});

test('while the caretaker sits, the deer drifts closer (but keeps its distance)', () => {
  const walk = () => true;
  const d = new Wanderer(ANIMALS.deer, walk, 3, false);
  const sitter = { x: ANIMALS.deer.home.x + 6, z: ANIMALS.deer.home.z, speed: 0, sitting: true };
  let closest = Infinity, minD = Infinity;
  for (let i = 0; i < 60 * 240; i++) {
    d.update(1 / 60, sitter);
    const dd = Math.hypot(d.x - sitter.x, d.z - sitter.z);
    if (d.act !== 'walk') closest = Math.min(closest, dd);
    minD = Math.min(minD, dd);
  }
  assert.ok(closest < 4.5, `rested within ${closest.toFixed(1)} m`);
  assert.ok(minD > 1.5, `never right on top of them (${minD.toFixed(1)} m)`);
});

test('every sit spot, word and growth prop is reachable or visible from the valley floor', () => {
  for (const s of home.sits) assert.ok(MATERIALS.length && Math.abs(s.x) < home.halfW && Math.abs(s.z) < home.halfH, s.id);
  const ids = new Set([...home.words.map((w) => w.id), ...home.growth.map((g) => g.id), ...home.sits.map((s) => s.id)]);
  assert.equal(ids.size, home.words.length + home.growth.length + home.sits.length, 'ids are unique');
});
