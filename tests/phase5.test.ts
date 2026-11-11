// Phase 5: seasons, collections, decorating. The calendar and hemisphere, seasonal presets for every candidate
// palette (A7 is undecided, so all three are checked the same way), seasonal finds (reachable, one season
// each, never needed), the collection book's derived friends, decorating rules (allowed ground, room, never
// cutting off anything the game needs), building styles as facts, save v7, and the seasonal ambience.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSeason, seasonNow, seasonOf } from '../src/core/clock';
import { seasonalPreset } from '../src/core/seasonal';
import { freshSave, parseSave, SAVE_VERSION } from '../src/core/save';
import { ambienceMix } from '../src/audio/ambience-mix';
import { BUILDINGS, buildingCost, type BuildingId } from '../src/data/buildings';
import { DECORATE, DECORATIONS } from '../src/data/decorations';
import { FINDS, findsOut } from '../src/data/finds';
import { PLACES } from '../src/data/places';
import { PRESETS } from '../src/data/presets';
import { DEFAULT_PALETTE, PALETTE_IDS, PALETTES, SEASON_IDS, seasonLook } from '../src/data/seasons';
import { validateData } from '../src/data/validate';
import { WORDS } from '../src/data/words';
import { decorationBlockers, decorationNear, everythingReachable, placementProblem } from '../src/sim/decorate';
import { IslandWorld } from '../src/sim/island';
import { CoreLoop } from '../src/sim/loop';
import { animalsMet, decorationsOffered } from '../src/sim/progress';
import { GameState, type Decoration } from '../src/sim/state';
import { reachFrom } from './helpers/reach';

const home = PLACES.home_valley;
const grove = PLACES.bamboo_grove;
const homeWorld = new IslandWorld(home);
const groveWorld = new IslandWorld(grove);
const all = [home, grove];
const full = (id: BuildingId) => ({ wood: 0, stone: 0, bamboo: 0, ...buildingCost(BUILDINGS[id]) });
const lum = (c: number) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);

test('data is valid with seasons, finds and decorations in it', () => {
  assert.deepEqual(validateData(), []);
  assert.ok(PALETTES[DEFAULT_PALETTE]);
  assert.equal(PALETTE_IDS.length, 3, 'A7 is undecided: three candidate palettes are on trial');
});

test('the calendar picks the season by month, the southern hemisphere six months on', () => {
  const at = (m: number) => new Date(2026, m, 15, 12);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => seasonOf(at(m), 'north')),
    ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']);
  assert.deepEqual([0, 3, 6, 9].map((m) => seasonOf(at(m), 'south')), ['summer', 'autumn', 'winter', 'spring']);
  // "Season: choose" wins over the calendar (plan 5: autumn in April).
  assert.equal(seasonNow({ mode: 'fixed', pick: 'autumn' }, 'north', at(3)), 'autumn');
  assert.equal(seasonNow({ mode: 'calendar', pick: 'autumn' }, 'north', at(3)), 'spring');
  assert.ok(isSeason('winter') && !isSeason('monsoon'));
});

test('every palette makes the four seasons look clearly different in both places (the Phase 5 gate)', () => {
  for (const pid of PALETTE_IDS) {
    for (const day of ['home_day', 'grove_day']) {
      const base = PRESETS[day]!;
      const looks = SEASON_IDS.map((s) => seasonalPreset(base, seasonLook(pid, s)));
      // Each pair of seasons differs in the ground, the crowns or the snow by a clear margin.
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const a = seasonLook(pid, SEASON_IDS[i]!), b = seasonLook(pid, SEASON_IDS[j]!);
        const ground = Math.abs(lum(looks[i]!.groundB) - lum(looks[j]!.groundB));
        const crowns = Math.abs(a.leafMix - b.leafMix) + (a.leaves[0] !== b.leaves[0] && Math.max(a.leafMix, b.leafMix) > 0.3 ? 0.5 : 0);
        const snow = Math.abs(a.snow - b.snow);
        const air = Math.abs(a.fall.amount - b.fall.amount) + Math.abs(a.coverAmount - b.coverAmount);
        assert.ok(ground > 12 || crowns > 0.3 || snow > 0.3 || air > 0.3, `${pid} ${day}: ${SEASON_IDS[i]} and ${SEASON_IDS[j]} look too alike`);
      }
      // Winter is the brightest ground; the time of day's light is untouched by the season.
      assert.ok(lum(looks[3]!.groundA) > lum(looks[0]!.groundA) + 25, `${pid}: winter ground should be snowy`);
      for (const l of looks) { assert.equal(l.sunColor, base.sunColor); assert.equal(l.sunI, base.sunI); assert.deepEqual(l.sunDir, base.sunDir); }
    }
    // Spring is the authored look: the ground and grass stay as they were built.
    const sp = seasonalPreset(PRESETS.home_day!, seasonLook(pid, 'spring'));
    assert.equal(sp.groundA, PRESETS.home_day!.groundA);
    assert.deepEqual(sp.grass, PRESETS.home_day!.grass);
  }
});

test('seasonal finds: one per place per season, out only in their season, reachable, and never needed', () => {
  for (const p of all) for (const s of SEASON_IDS) {
    const fs = Object.values(FINDS).filter((f) => f.place === p.id && f.season === s);
    assert.equal(fs.length, 1, `${p.id} ${s}`);
  }
  for (const id of Object.keys(FINDS)) assert.ok(!WORDS[id], 'finds and words share the collection, so ids must differ');
  assert.deepEqual(findsOut('home_valley', 'autumn', new Set()).map((f) => f.id), ['find_leaf']);
  assert.deepEqual(findsOut('home_valley', 'autumn', new Set(['find_leaf'])), []);
  // Reachable from where a player arrives, and standing clear of trunks and rocks.
  for (const [p, w, from] of [[home, homeWorld, home.spawn], [grove, groveWorld, grove.arrivals.trail!]] as const) {
    const r = reachFrom(p, from, p.sites.map((s) => ({ x: s.x, z: s.z, r: BUILDINGS[s.building].solidRadius })), w);
    for (const f of Object.values(FINDS).filter((q) => q.place === p.id)) {
      assert.ok(w.walkable(f.x, f.z), `${f.id} is on standable ground`);
      assert.ok(r.reachable(f.x, f.z, 1.2), `${f.id} can be reached`);
      for (const b of w.solids) assert.ok(Math.hypot(b.x - f.x, b.z - f.z) > b.r + 0.2, `${f.id} is not inside a trunk or rock`);
    }
  }
  // Nothing in the sim depends on the season: buildings, sites and the loop never read it (plan 5: collections
  // stay fair). A find is only a fact in the collection.
  const st = new GameState(all);
  assert.ok(st.collect('find_leaf'));
  assert.ok(!st.collect('find_leaf'), 'a find is collected once');
  assert.ok(!st.collect('find_nonsense'));
  assert.deepEqual(st.toFacts().collection, ['find_leaf']);
});

test('the book: animal friends met are derived from the facts, not saved', () => {
  const st = new GameState(all);
  assert.deepEqual(animalsMet(all, st.deposits), []);
  st.deposits.shelter = full('shelter');
  st.deposits.gravel_garden = full('gravel_garden');
  assert.deepEqual(animalsMet(all, st.deposits).map((a) => a.id), ['deer']);
  st.deposits.wind_shrine = full('wind_shrine');
  assert.deepEqual(animalsMet(all, st.deposits).map((a) => a.id).sort(), ['crane', 'deer']);
});

test('decorations are offered by completed buildings and shrines, never bought', () => {
  assert.deepEqual(decorationsOffered(new Set()), []);
  const afterShelter = decorationsOffered(new Set<BuildingId>(['shelter'])).map((d) => d.id);
  assert.ok(afterShelter.length > 0 && afterShelter.every((id) => DECORATIONS[id]!.from === 'shelter'));
  const everything = decorationsOffered(new Set(Object.keys(BUILDINGS) as BuildingId[]));
  assert.equal(everything.length, Object.keys(DECORATIONS).length);
  assert.ok(everything.some((d) => d.from === 'wind_shrine'), 'the grove\'s shrine adds decorations at home');
});

test('decorating: allowed ground only, with room, off the path, never at the grove', () => {
  const ok = (id: string, x: number, z: number, others: Decoration[] = []) => placementProblem(home, homeWorld, others, id, x, z);
  assert.equal(ok('stone_lantern', 5.0, 8.8), null);
  assert.equal(ok('stone_lantern', 1.6, 12), 'path', 'on the path');
  assert.equal(ok('stone_lantern', home.pond.x, home.pond.z), 'water', 'in the pond');
  assert.equal(ok('stone_lantern', 9.5, -3.5), 'in_the_way', 'on the shelter\'s site');
  assert.equal(ok('stone_lantern', 6.2, 5.6), 'in_the_way', 'on a tree you gather from');
  assert.equal(ok('stone_lantern', -9, 4.6), 'in_the_way', 'on a sit spot');
  assert.equal(ok('stone_lantern', 30, 0), 'not_here', 'outside the valley floor');
  assert.equal(ok('stone_lantern', 5.3, 8.8, [{ id: 'cherry', place: 'home_valley', x: 5, z: 8.8, rot: 0 }]), 'crowded');
  assert.equal(placementProblem(grove, groveWorld, [], 'stone_lantern', 4, 0), 'not_here', 'decorating is at home only');
  assert.equal(ok('nonsense', 5.0, 8.8), 'not_here');
  const max = DECORATE.home_valley!.max;
  const many = Array.from({ length: max }, (_, i) => ({ id: 'fern', place: 'home_valley', x: i, z: 30, rot: 0 }));
  assert.equal(ok('stone_lantern', 5.0, 8.8, many), 'full');
  // Placed close in front of a standing caretaker, a solid one would trap them; a flower bed would not.
  assert.equal(placementProblem(home, homeWorld, [], 'stone_lantern', 5.0, 8.8, { x: 5.3, z: 8.8 }), 'in_the_way');
  assert.equal(placementProblem(home, homeWorld, [], 'flower_bed', 5.0, 8.8, { x: 5.3, z: 8.8 }), null);
});

test('decorating never cuts the caretaker off from anything the game needs', () => {
  assert.ok(everythingReachable(home, homeWorld, [], home.spawn));
  // A wall of lanterns right across the valley would cut the gate off from the hall: refused.
  const wall: Decoration[] = [];
  for (let x = -home.halfW - 3; x <= home.halfW + 3; x += 0.6) wall.push({ id: 'stone_lantern', place: 'home_valley', x, z: 3, rot: 0 });
  assert.ok(!everythingReachable(home, homeWorld, wall, home.spawn));
  // Flower beds are not solid: the same wall of them blocks nothing.
  assert.ok(everythingReachable(home, homeWorld, wall.map((d) => ({ ...d, id: 'flower_bed' })), home.spawn));
  assert.equal(decorationBlockers(wall, 'home_valley').length, wall.length);
  assert.equal(decorationBlockers(wall, 'bamboo_grove').length, 0);
  assert.equal(decorationNear(wall, 'home_valley', 0.1, 3.2), wall.findIndex((d) => Math.abs(d.x) < 0.31));
  assert.equal(decorationNear(wall, 'home_valley', 0, 10), -1);
});

test('decorations and styles are facts: placed, removed, limited, repaired, and solid in the loop', () => {
  const st = new GameState(all);
  const seen: string[] = [];
  st.on((e) => seen.push(e.type));
  assert.ok(st.decorate({ id: 'stone_lantern', place: 'home_valley', x: 5, z: 8.8, rot: 0.3 }));
  assert.ok(!st.decorate({ id: 'nonsense', place: 'home_valley', x: 5, z: 8.8, rot: 0 }));
  assert.ok(!st.decorate({ id: 'fern', place: 'atlantis', x: 5, z: 8.8, rot: 0 }));
  assert.ok(!st.decorate({ id: 'fern', place: 'bamboo_grove', x: 5, z: 8.8, rot: 0 }), 'no decorating in the grove');
  // The loop collides with solid decorations (read again when they change).
  const loop = new CoreLoop(home, { walkable: (x, z) => homeWorld.walkable(x, z), get solids() { return [...homeWorld.solids, ...decorationBlockers(st.decorations, 'home_valley')]; } }, st, home.spawn);
  assert.ok(loop.area.blockers.some((b) => b.x === 5 && b.z === 8.8));
  assert.ok(st.undecorate(0));
  assert.ok(!loop.area.blockers.some((b) => b.x === 5 && b.z === 8.8));
  assert.ok(!st.undecorate(0));
  assert.equal(st.styleOf('meditation_hall'), 'timber');
  assert.ok(st.setStyle('meditation_hall', 'temple'));
  assert.ok(!st.setStyle('meditation_hall', 'temple'), 'no change, no event');
  assert.ok(!st.setStyle('meditation_hall', 'gothic'));
  assert.ok(!st.setStyle('nowhere', 'temple'));
  assert.deepEqual(seen, ['decorated', 'undecorated', 'styled']);
  assert.deepEqual(st.toFacts().styles, { meditation_hall: 'temple' });
  assert.ok(st.setStyle('meditation_hall', 'timber'));
  assert.deepEqual(st.toFacts().styles, {}, 'the default style is not stored');
  // Loading repairs: unknown ids, places and styles are dropped; a place's limit holds.
  const max = DECORATE.home_valley!.max;
  const facts = {
    satchel: {}, deposits: {},
    decorations: [
      ...Array.from({ length: max + 5 }, (_, i) => ({ id: 'fern', place: 'home_valley', x: i, z: 0, rot: 0 })),
      { id: 'nonsense', place: 'home_valley', x: 0, z: 0, rot: 0 },
    ],
    styles: { shelter: 'temple', tea_house: 'gothic', nowhere: 'temple' },
  };
  const loaded = new GameState(all, facts);
  assert.equal(loaded.decorations.length, max);
  assert.deepEqual(loaded.styles, { shelter: 'temple' });
});

test('save v7: seasons, hemisphere, palette, decorations and styles; v6 saves migrate untouched', () => {
  assert.equal(SAVE_VERSION, 7);
  const f = freshSave();
  assert.deepEqual(f.settings.season, { mode: 'calendar', pick: 'spring' });
  assert.equal(f.settings.hemisphere, 'north');
  assert.deepEqual(f.decorations, []);
  assert.deepEqual(f.styles, {});
  const v6 = { v: 6, opened: true, places: ['home_valley'], at: { place: 'home_valley', x: 1, z: 2 }, deposits: { shelter: { wood: 20 } }, collection: ['poem_pond'] };
  const m = parseSave(JSON.stringify(v6));
  assert.equal(m.recovered, null);
  assert.equal(m.data.v, 7);
  assert.deepEqual(m.data.deposits, { shelter: { wood: 20 } }, 'v6 counted pieces already: nothing changes');
  assert.deepEqual(m.data.collection, ['poem_pond']);
  assert.deepEqual(m.data.decorations, []);
  const odd = parseSave(JSON.stringify({
    v: 7,
    decorations: [{ id: 'fern', place: 'home_valley', x: 1.234, z: 2, rot: 7 }, { id: 'BAD!', place: 'home_valley', x: 0, z: 0 }, { id: 'fern', place: 'home_valley', x: 'a', z: 0 }, 5],
    styles: { shelter: 'temple', 'BAD!': 'temple', hall: 3 },
    settings: { season: { mode: 'fixed', pick: 'monsoon' }, hemisphere: 'east', palette: 'bold' },
  })).data;
  assert.equal(odd.decorations.length, 1);
  assert.equal(odd.decorations[0]!.x, 1.23);
  assert.ok(odd.decorations[0]!.rot >= 0 && odd.decorations[0]!.rot < Math.PI * 2);
  assert.deepEqual(odd.styles, { shelter: 'temple' });
  assert.deepEqual(odd.settings.season, { mode: 'fixed', pick: 'spring' });
  assert.equal(odd.settings.hemisphere, 'north');
  assert.equal(odd.settings.palette, 'bold');
});

test('ambience follows the season: hushed winter, loud summer nights, windier autumn', () => {
  const noon = 0.5, night = 0.95;
  const w = ambienceMix(noon, 1, 0, 'valley', 'winter'), sp = ambienceMix(noon, 1, 0, 'valley', 'spring');
  assert.ok(w.birds < sp.birds * 0.5);
  assert.equal(ambienceMix(night, 1, 0, 'valley', 'winter').crickets, 0);
  assert.ok(ambienceMix(night, 1, 0, 'valley', 'summer').crickets > ambienceMix(night, 1, 0, 'valley', 'spring').crickets);
  assert.ok(ambienceMix(noon, 1, 0, 'valley', 'autumn').wind > sp.wind);
  assert.ok(ambienceMix(noon, 1, 0, 'valley', 'autumn').chimes > 0, 'wind chimes at home in autumn (plan 8)');
  for (const s of SEASON_IDS) for (const v of Object.values(ambienceMix(night, 1, 1, 'grove', s))) assert.ok(v >= 0 && v <= 2);
});
