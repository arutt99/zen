// Phase 4: the first journey. Bamboo, the grove, exits and arrivals, the wind shrine and the tea house
// (a site that waits on a building in another place), discovered places and the travel map, the crane,
// save v5, reachability of everything in both places, and the journey bot playing the Phase 4 gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, parseSave, SAVE_VERSION } from '../src/core/save';
import { ANIMALS } from '../src/data/animals';
import { BUILDINGS, buildingCost } from '../src/data/buildings';
import { MATERIALS, NODE_KINDS, SATCHEL_CAP } from '../src/data/gathering';
import { PLACE_IDS, PLACES } from '../src/data/places';
import { DAY_CYCLES, PRESETS } from '../src/data/presets';
import { RITUALS } from '../src/data/rituals';
import { ARRIVALS, WORDS } from '../src/data/words';
import { validateData } from '../src/data/validate';
import { IslandWorld } from '../src/sim/island';
import { CoreLoop, type GroundQuery } from '../src/sim/loop';
import { runJourneyBot } from '../src/sim/pacing-bot';
import { animalsPresent, completedAll, isComplete, partsBuilt, exitOpen, growthShown, mapUnlocked, restoration, siteOpen } from '../src/sim/progress';
import { GameState } from '../src/sim/state';
import { reachFrom } from './helpers/reach';

const home = PLACES.home_valley;
const grove = PLACES.bamboo_grove;
const full = (id: keyof typeof BUILDINGS) => ({ wood: 0, stone: 0, bamboo: 0, ...buildingCost(BUILDINGS[id]) });
const worlds = { home_valley: new IslandWorld(home), bamboo_grove: new IslandWorld(grove) };
const ground = (id: keyof typeof worlds): GroundQuery => ({ walkable: (x, z) => worlds[id].walkable(x, z), solids: worlds[id].solids });

test('data is valid with the grove in it', () => {
  assert.deepEqual(validateData(), []);
  assert.deepEqual(PLACE_IDS, ['home_valley', 'bamboo_grove']);
});

test('bamboo is a material that only grows in the grove; the plan 9.6 tea house costs 6 wood, 8 bamboo parts (cut into pieces), one satchel of bamboo', () => {
  assert.ok(MATERIALS.includes('bamboo'));
  assert.equal(NODE_KINDS.bamboo.material, 'bamboo');
  assert.ok(grove.nodes.some((n) => n.kind === 'bamboo'));
  assert.ok(!home.nodes.some((n) => n.kind === 'bamboo'));
  assert.deepEqual(BUILDINGS.tea_house.authored.filter((p) => p.material === 'bamboo').length, 8);
  assert.deepEqual(BUILDINGS.tea_house.authored.filter((p) => p.material === 'wood').length, 6);
  // Bamboo comes from another place: the tea house never needs more than one satchel of it.
  assert.ok(buildingCost(BUILDINGS.tea_house).bamboo! <= SATCHEL_CAP);
  assert.equal(BUILDINGS.tea_house.place, 'home_valley');
  assert.equal(BUILDINGS.wind_shrine.place, 'bamboo_grove');
  // Everything the shrine needs grows in the grove.
  for (const m of Object.keys(buildingCost(BUILDINGS.wind_shrine))) assert.ok(grove.nodes.some((n) => NODE_KINDS[n.kind].material === m), m);
});

test('gathering a bamboo clump fills the satchel with bamboo, one culm per beat', () => {
  const place = { ...grove, nodes: [{ id: 'b', kind: 'bamboo' as const, x: 0, z: 0 }], sites: [], exits: [] };
  const state = new GameState([place]);
  const loop = new CoreLoop(place, { walkable: () => true, solids: [] }, state, { x: 1.2, z: 0 });
  for (let i = 0; i < 60 * 4; i++) loop.step(1 / 60, { x: 0, z: 0 });
  assert.equal(state.satchel.bamboo, NODE_KINDS.bamboo.units);
  assert.equal(loop.nodes[0]!.units, 0);
});

test('the tea house at home opens only once the grove\'s wind shrine is restored', () => {
  const state = new GameState([home, grove]);
  const tea = BUILDINGS.tea_house;
  assert.ok(!siteOpen(tea, completedAll(state.siteBuilding, state.deposits)));
  // Even with the whole valley built.
  for (const s of home.sites) if (s.building !== 'tea_house') state.deposits[s.id] = full(s.building);
  assert.ok(!siteOpen(tea, completedAll(state.siteBuilding, state.deposits)));
  state.deposits.wind_shrine = full('wind_shrine');
  assert.ok(siteOpen(tea, completedAll(state.siteBuilding, state.deposits)));
  // And the loop at home agrees.
  const loop = new CoreLoop(home, ground('home_valley'), state, home.spawn);
  assert.ok(loop.siteOpen(loop.sites.find((s) => s.id === 'tea_house')!));
  loop.dispose();
});

test('the trail gate: the exit is shut (and blocks the gate) until the bell tower, then walking in travels', () => {
  const exit = home.exits[0]!;
  assert.equal(exit.to, 'bamboo_grove');
  assert.ok(!exitOpen(exit, new Set()));
  assert.ok(exitOpen(exit, new Set(['bell_tower'])));
  const flat: GroundQuery = { walkable: () => true, solids: [] };
  const place = { ...home, nodes: [], sites: home.sites.filter((s) => s.id === 'bell_tower') };
  const state = new GameState([place]);
  const loop = new CoreLoop(place, flat, state, { x: exit.x, z: exit.z + 4 });
  const left: string[] = [];
  loop.onLeave = (e) => left.push(e.id);
  assert.ok(loop.area.blockers.some((b) => b.x === exit.closed![0]!.x), 'shut gate blocks');
  for (let i = 0; i < 300; i++) loop.step(1 / 60, { x: 0, z: -1 });
  assert.deepEqual(left, [], 'a shut exit never fires');
  state.deposits.bell_tower = full('bell_tower');
  state.on(() => undefined);
  // Completing the tower re-derives the blockers.
  (loop as unknown as { blockersDirty: boolean }).blockersDirty = true;
  assert.ok(!loop.area.blockers.some((b) => b.x === exit.closed![0]!.x), 'open gate no longer blocks');
  loop.walker.x = exit.x; loop.walker.z = exit.z + 3;
  for (let i = 0; i < 300 && !left.length; i++) loop.step(1 / 60, { x: 0, z: -1 });
  assert.deepEqual(left, ['trail_grove']);
  loop.dispose();
});

test('exits and arrivals pair up both ways, and nobody arrives inside an exit', () => {
  for (const p of Object.values(PLACES)) {
    for (const e of p.exits) {
      const to = PLACES[e.to];
      assert.ok(to.arrivals[e.arrive], `${p.id} → ${e.to}:${e.arrive}`);
      assert.ok(to.exits.some((b) => b.to === p.id), `${e.to} has a way back to ${p.id}`);
    }
  }
});

test('everything in both places is reachable on foot from where you arrive', () => {
  const cases: [typeof home, { x: number; z: number }][] = [[home, home.spawn], [home, home.arrivals.trail!], [grove, grove.arrivals.trail!], [grove, grove.arrivals.map!]];
  for (const [p, from] of cases) {
    const sites = p.sites.map((s) => ({ x: s.x, z: s.z, r: BUILDINGS[s.building].solidRadius }));
    const r = reachFrom(p, from, sites, worlds[p.id]);
    const where = `${p.id} from (${from.x}, ${from.z})`;
    for (const [id, a] of Object.entries(p.arrivals)) assert.ok(r.reachable(a.x, a.z, 0.3), `${where}: arrival ${id}`);
    for (const e of p.exits) assert.ok(r.reachable(e.x, e.z, e.r * 0.8), `${where}: exit ${e.id}`);
    for (const s of p.sites) assert.ok(r.reachable(s.x, s.z, BUILDINGS[s.building].siteRadius * 0.9), `${where}: site ${s.id}`);
    for (const n of p.nodes) assert.ok(r.reachable(n.x, n.z, NODE_KINDS[n.kind].radius * 0.9), `${where}: node ${n.id}`);
    for (const s of p.sits) assert.ok(r.reachable(s.x, s.z, 1.8), `${where}: sit ${s.id}`);
    for (const w of p.words) assert.ok(r.reachable(w.x, w.z, 1.7), `${where}: words ${w.id}`);
    assert.ok(r.reachable(p.map.x, p.map.z, 1.8), `${where}: map board`);
  }
});

test('discovering places: a fact, once each; the map unlocks with the second place', () => {
  const state = new GameState([home, grove]);
  const seen: string[] = [];
  state.on((e) => { if (e.type === 'discovered') seen.push(e.place); });
  assert.ok(state.discover('home_valley'));
  assert.ok(!mapUnlocked(state.places));
  assert.ok(!state.discover('home_valley'));
  assert.ok(!state.discover('nowhere'));
  assert.ok(state.discover('bamboo_grove'));
  assert.ok(mapUnlocked(state.places));
  assert.deepEqual(seen, ['home_valley', 'bamboo_grove']);
  assert.deepEqual(state.toFacts().places, ['bamboo_grove', 'home_valley']);
  // Loading keeps known places and drops unknown ones.
  const again = new GameState([home, grove], { satchel: {}, deposits: {}, places: ['bamboo_grove', 'atlantis'] });
  assert.deepEqual([...again.places], ['bamboo_grove']);
});

test('the satchel carries bamboo across places (one set of facts for the whole game)', () => {
  const state = new GameState([home, grove], { satchel: { bamboo: 8, wood: 6 }, deposits: {} });
  state.deposits.wind_shrine = full('wind_shrine');
  assert.ok(state.deposit('tea_house', 'bamboo'));
  assert.equal(state.satchel.bamboo, 7);
  assert.equal(state.deposits.tea_house!.bamboo, 1);
});

test('the grove heals with its shrine: restoration, overgrowth, mist, water and the crane', () => {
  assert.equal(restoration(grove, {}), 0);
  const deposits = { wind_shrine: full('wind_shrine') };
  assert.equal(restoration(grove, deposits), 1);
  for (const g of grove.growth) assert.equal(growthShown(g, 1), g.max !== undefined ? 0 : 1, g.id);
  assert.deepEqual(animalsPresent(grove, {}), []);
  assert.deepEqual(animalsPresent(grove, deposits).map((a) => a.id), ['crane']);
  assert.equal(ANIMALS.crane.place, 'bamboo_grove');
  // The home valley's animals don't wander into the grove, and the crane stays in it.
  assert.ok(!animalsPresent(home, { shelter: full('shelter'), gravel_garden: full('gravel_garden') }).some((a) => a.id === 'crane'));
});

test('the tea house adds its touches at home only once it is built (it adds no restoration)', () => {
  const tea = home.growth.filter((g) => g.requires === 'tea_house');
  assert.ok(tea.length >= 2);
  for (const g of tea) {
    assert.equal(growthShown(g, 1, new Set(['bell_tower'])), 0, g.id);
    assert.equal(growthShown(g, 1, new Set(['tea_house'])), 1, g.id);
  }
  assert.equal(BUILDINGS.tea_house.restoration, 0);
  assert.equal(RITUALS.make_tea.building, 'tea_house');
});

test('the grove has its own light along the same day, and its own words', () => {
  assert.equal(grove.daylight, 'grove');
  for (const [, id] of DAY_CYCLES.grove!) assert.ok(PRESETS[id], id);
  assert.notEqual(PRESETS.grove_day!.groundA, PRESETS.home_day!.groundA);
  assert.equal(PRESETS.grove_night!.stars, PRESETS.home_night!.stars);
  for (const w of grove.words) assert.ok(WORDS[w.id]!.lines.length > 0);
  assert.ok(grove.words.filter((w) => WORDS[w.id]!.kind === 'poem').length >= 2);
  assert.ok(ARRIVALS.bamboo_grove?.lines.length);
});

test('save v5: places are kept and repaired; v4 saves migrate (a started game has reached home)', () => {
  assert.equal(SAVE_VERSION, 6);
  assert.deepEqual(freshSave().places, []);
  const v4 = { v: 4, opened: true, at: { place: 'home_valley', x: 1, z: 2 }, deposits: { bell_tower: { wood: 10, stone: 8 } } };
  const m = parseSave(JSON.stringify(v4));
  assert.equal(m.recovered, null);
  assert.deepEqual(m.data.places, ['home_valley']);
  const odd = parseSave(JSON.stringify({ v: 5, places: ['bamboo_grove', 'bamboo_grove', 'BAD!', 7], at: { place: 'bamboo_grove', x: 2, z: 17 } })).data;
  assert.deepEqual(odd.places, ['bamboo_grove']);
  assert.equal(odd.at.place, 'bamboo_grove');
  assert.deepEqual(parseSave(JSON.stringify({ v: 4 })).data.places, []);
});

test('journey bot: home valley → trail → wind shrine + bamboo → back → tea house, with nothing soft-locked', () => {
  const grounds = { home_valley: ground('home_valley'), bamboo_grove: ground('bamboo_grove') };
  const perfect = runJourneyBot(home, grove, grounds, { maxSeconds: 3600 });
  assert.ok(!perfect.timedOut, JSON.stringify(perfect));
  assert.ok(perfect.completedAt.wind_shrine! > perfect.completedAt.bell_tower!);
  assert.ok(perfect.completedAt.tea_house! > perfect.completedAt.wind_shrine!);
  const relaxed = runJourneyBot(home, grove, grounds, { maxSeconds: 5400, style: 'relaxed', seed: 3 });
  assert.ok(!relaxed.timedOut);
  const fmt = (r: typeof perfect) => `home ${(r.legs.home / 60).toFixed(1)} min, grove leg ${((r.legs.grove - r.legs.home) / 60).toFixed(1)} min, tea house leg ${((r.legs.teaHouse - r.legs.grove) / 60).toFixed(1)} min`;
  console.log(`   journey bot, perfect: ${fmt(perfect)}`);
  console.log(`   journey bot, relaxed: ${fmt(relaxed)}`);
  // Pacing pass (2026-11-11): the plan's 20–30 minutes is for a first visit; a relaxed bot that knows the way
  // should land somewhat under it, and a perfect one well under, but neither in a couple of minutes.
  assert.ok(perfect.legs.teaHouse > 8 * 60, `perfect journey ${(perfect.legs.teaHouse / 60).toFixed(1)} min`);
  assert.ok(relaxed.legs.teaHouse > 11 * 60 && relaxed.legs.teaHouse < 30 * 60, `relaxed journey ${(relaxed.legs.teaHouse / 60).toFixed(1)} min`);
});

test('save v6: a v5 save keeps exactly the parts it had built, now counted in pieces (pacing pass)', () => {
  const v5 = { v: 5, places: ['home_valley', 'bamboo_grove'], opened: true, at: { place: 'home_valley', x: 1, z: 2 },
    deposits: { shelter: { wood: 6 }, gravel_garden: { wood: 2, stone: 3 }, wind_shrine: { stone: 4, bamboo: 8 }, mystery: { wood: 2 } } };
  const { data, recovered } = parseSave(JSON.stringify(v5));
  assert.equal(recovered, null);
  const st = new GameState([home, grove], data);
  assert.ok(isComplete(BUILDINGS.shelter, st.deposits.shelter!), 'a finished shelter stays finished');
  assert.ok(isComplete(BUILDINGS.wind_shrine, st.deposits.wind_shrine!), 'a restored shrine stays restored');
  // The garden had its first 2 wood and 3 stone parts: those parts are whole, nothing after them.
  const built = partsBuilt(BUILDINGS.gravel_garden, st.deposits.gravel_garden!);
  const whole = new Set(BUILDINGS.gravel_garden.parts.filter((_, i) => built[i]).map((p) => p.id));
  const authored = BUILDINGS.gravel_garden.authored;
  const expect = new Set([...authored.filter((p) => p.material === 'wood').slice(0, 2), ...authored.filter((p) => p.material === 'stone').slice(0, 3)].map((p) => p.id));
  assert.deepEqual([...whole].sort(), [...expect].sort());
  BUILDINGS.gravel_garden.parts.forEach((p, i) => { if (expect.has(p.id)) assert.ok(built[i], `${p.id} piece ${p.piece}`); });
  assert.deepEqual(data.deposits.mystery, { wood: 2 }, 'unknown sites pass through (sim/state drops them on load)');
});
