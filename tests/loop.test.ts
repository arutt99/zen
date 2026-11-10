// The Phase 1 core loop, headless: gathering on the beat, the satchel cap, deposits, derived
// progress, the save round trip and a pacing-bot run on the real home valley.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../src/data/buildings';
import { BEAT_SECONDS, FIRST_BEAT_SECONDS, NODE_KINDS, SATCHEL_CAP } from '../src/data/gathering';
import { PLACES, type PlaceDef } from '../src/data/places';
import { freshSave, parseSave, serializeSave } from '../src/core/save';
import { IslandWorld } from '../src/sim/island';
import { CoreLoop, type GroundQuery } from '../src/sim/loop';
import { GatherNode } from '../src/sim/nodes';
import { runPacingBot } from '../src/sim/pacing-bot';
import { isComplete, mistAmount, nextDeposit, partsBuilt, remaining, restoration } from '../src/sim/progress';
import { GameState, type GameEvent } from '../src/sim/state';

const home = PLACES.home_valley;
const shelter = BUILDINGS.shelter;
const flat: GroundQuery = { walkable: () => true, solids: [] };
const still = { x: 0, z: 0 };

/** A tiny test place: one tree at the origin, one boulder, and the shelter site far away. */
const testPlace: PlaceDef = {
  ...home,
  nodes: [{ id: 't', kind: 'tree', x: 0, z: 0 }, { id: 'b', kind: 'boulder', x: 0, z: 10 }],
  sites: [{ id: 'shelter', building: 'shelter', x: 20, z: 0 }],
};
const run = (loop: CoreLoop, seconds: number, move = still, dt = 1 / 60) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) loop.step(dt, move);
};

test('gathering takes one unit per beat, starting after the first swing', () => {
  const state = new GameState([testPlace]);
  const events: GameEvent[] = [];
  state.on((e) => events.push(e));
  const loop = new CoreLoop(testPlace, flat, state, { x: 1.2, z: 0 });
  run(loop, FIRST_BEAT_SECONDS - 0.05);
  assert.equal(state.satchel.wood, 0, 'nothing before the first swing lands');
  run(loop, 0.1);
  assert.equal(state.satchel.wood, 1);
  run(loop, BEAT_SECONDS * 2);
  assert.equal(state.satchel.wood, 3);
  assert.deepEqual(events.filter((e) => e.type === 'gathered').map((e) => e.type === 'gathered' && e.unit), [0, 1, 2]);
  assert.equal(loop.work?.kind, 'chop');
});

test('walking away stops gathering at once and the node stays half-gathered', () => {
  const state = new GameState([testPlace]);
  const loop = new CoreLoop(testPlace, flat, state, { x: 1.2, z: 0 });
  run(loop, FIRST_BEAT_SECONDS + BEAT_SECONDS + 0.05); // two units
  assert.equal(state.satchel.wood, 2);
  run(loop, 1.5, { x: 1, z: 0 }); // walk away east
  const tree = loop.nodes[0]!;
  assert.equal(state.satchel.wood, 2, 'every awarded unit was already in the satchel; none after leaving');
  run(loop, 120, still);
  assert.equal(tree.units, tree.def.units - 2, 'a half-gathered tree does not regrow while you are away');
  assert.equal(tree.phase, 'ready');
});

test('an emptied node rests, then regrows one unit at a time, and is not gatherable meanwhile', () => {
  const n = new GatherNode('t', 'tree', 0, 0);
  const def = NODE_KINDS.tree;
  for (let i = 0; i < def.units; i++) assert.equal(n.take(), i);
  assert.equal(n.take(), -1);
  assert.equal(n.phase, 'resting');
  n.update(def.restSeconds - 0.01);
  assert.equal(n.units, 0);
  n.update(0.02 + def.regrowSecondsPerUnit);
  assert.equal(n.units, 1);
  assert.equal(n.canGather, false, 'regrowing nodes wait until full');
  n.update(def.regrowSecondsPerUnit * def.units);
  assert.equal(n.units, def.units);
  assert.equal(n.canGather, true);
});

test('the satchel caps each material and a full satchel stops gathering that material', () => {
  const state = new GameState([testPlace]);
  for (let i = 0; i < SATCHEL_CAP + 5; i++) state.gather('t', 'wood', 0, 0);
  assert.equal(state.satchel.wood, SATCHEL_CAP);
  assert.equal(state.gather('t', 'wood', 0, 0), false);
  const loop = new CoreLoop(testPlace, flat, state, { x: 1.2, z: 0 });
  run(loop, 3);
  assert.equal(loop.nodes[0]!.units, NODE_KINDS.tree.units, 'the tree is untouched while the satchel is full of wood');
  assert.equal(loop.sensor.current, null);
  assert.ok(state.gather('b', 'stone', 0, 0), 'other materials still fit');
});

test('deposits flow one per beat and never exceed the cost', () => {
  const state = new GameState([testPlace]);
  for (let i = 0; i < SATCHEL_CAP; i++) state.gather('t', 'wood', 0, 0);
  const events: GameEvent[] = [];
  state.on((e) => events.push(e));
  const loop = new CoreLoop(testPlace, flat, state, { x: 20 + 2, z: 0 });
  run(loop, FIRST_BEAT_SECONDS + 0.05);
  assert.equal(state.deposits.shelter!.wood, 1);
  run(loop, BEAT_SECONDS * 20);
  assert.equal(state.deposits.shelter!.wood, shelter.parts.length);
  assert.equal(state.satchel.wood, SATCHEL_CAP - shelter.parts.length);
  assert.equal(events.filter((e) => e.type === 'completed').length, 1);
  assert.deepEqual(events.filter((e) => e.type === 'deposited').map((e) => e.type === 'deposited' && e.part), [0, 1, 2, 3, 4, 5]);
  assert.equal(state.deposit('shelter', 'wood'), false, 'a complete building takes nothing more');
  assert.equal(state.deposit('shelter', 'stone'), false, 'nor a material it does not use');
  assert.equal(state.deposit('nowhere', 'wood'), false);
});

test('a partial deposit leaves the building partly built and the rest of the cost outstanding', () => {
  const state = new GameState([testPlace]);
  for (let i = 0; i < 4; i++) state.gather('t', 'wood', 0, 0);
  const loop = new CoreLoop(testPlace, flat, state, { x: 22, z: 0 });
  run(loop, 10);
  const d = state.deposits.shelter!;
  assert.equal(d.wood, 4);
  assert.deepEqual(partsBuilt(shelter, d), [true, true, true, true, false, false]);
  assert.deepEqual(remaining(shelter, d), { wood: 2, stone: 0 });
  assert.equal(isComplete(shelter, d), false);
  assert.equal(loop.work, null, 'no work animation with nothing left to give');
  assert.equal(nextDeposit(shelter, d, state.satchel), null);
});

test('mixed-material buildings take parts in order, per material', () => {
  const mixed = { ...shelter, parts: [{ id: 'a', material: 'stone' as const }, { id: 'b', material: 'wood' as const }, { id: 'c', material: 'stone' as const }] };
  assert.deepEqual(partsBuilt(mixed, { wood: 1, stone: 1 }), [true, true, false]);
  assert.equal(nextDeposit(mixed, { wood: 0, stone: 0 }, { wood: 3, stone: 0 }), 'wood');
  assert.equal(nextDeposit(mixed, { wood: 0, stone: 0 }, { wood: 3, stone: 3 }), 'stone');
});

test('restoration and mist are derived from completed buildings only', () => {
  const full = { shelter: { wood: shelter.parts.length, stone: 0 } };
  const part = { shelter: { wood: 3, stone: 0 } };
  assert.equal(restoration(home, part), 0);
  assert.equal(mistAmount(home, restoration(home, part)), 1);
  assert.equal(restoration(home, full), shelter.restoration);
  assert.equal(mistAmount(home, restoration(home, full)), 0, 'the shelter lifts the home mist (plan 9.6)');
});

test('loading facts repairs them: unknown sites dropped, counts clamped to cost and cap', () => {
  const s = new GameState([home], { satchel: { wood: 999, stone: -4 }, deposits: { shelter: { wood: 50, stone: 3 }, ghost: { wood: 2 } } });
  assert.deepEqual(s.satchel, { wood: SATCHEL_CAP, stone: 0 });
  assert.deepEqual(s.deposits.shelter, { wood: shelter.parts.length, stone: 0 });
  assert.equal(s.deposits.ghost, undefined);
});

test('save round trip restores exactly what was delivered and carried', () => {
  const a = new GameState([home]);
  for (let i = 0; i < 9; i++) a.gather('t', 'wood', 0, 0);
  a.gather('b', 'stone', 0, 0);
  for (let i = 0; i < 4; i++) a.deposit('shelter', 'wood');
  const save = { ...freshSave(), ...a.toFacts() };
  const { data, recovered } = parseSave(serializeSave(save));
  assert.equal(recovered, null);
  const b = new GameState([home], data);
  assert.deepEqual(b.satchel, a.satchel);
  assert.deepEqual(b.deposits, a.deposits);
  assert.deepEqual(partsBuilt(shelter, b.deposits.shelter!), partsBuilt(shelter, a.deposits.shelter!));
});

test('a corrupt save starts fresh with an empty satchel and no deposits', () => {
  const { data } = parseSave('{"v":2,"deposits":');
  const s = new GameState([home], data);
  assert.deepEqual(s.satchel, { wood: 0, stone: 0 });
  assert.equal(s.deposits.shelter!.wood, 0);
});

const world = new IslandWorld(home);
const ground: GroundQuery = { walkable: (x, z) => world.walkable(x, z), solids: world.solids };

test('every gather node and site can be reached on the home island', () => {
  for (const n of [...home.nodes.map((q) => ({ ...q, r: NODE_KINDS[q.kind].radius })), ...home.sites.map((q) => ({ ...q, r: BUILDINGS[q.building].siteRadius }))]) {
    let ok = 0;
    for (let a = 0; a < 16; a++) {
      const x = n.x + Math.cos((a / 16) * Math.PI * 2) * n.r * 0.75, z = n.z + Math.sin((a / 16) * Math.PI * 2) * n.r * 0.75;
      if (world.walkable(x, z) && world.solids.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + 0.35)) ok++;
    }
    assert.ok(ok >= 6, `${n.id}: only ${ok}/16 standing spots around it`);
  }
});

test('pacing bot: the whole home valley gets built from a fresh start, in order, with cycles under 90 s', () => {
  const r = runPacingBot(home, ground);
  assert.equal(r.timedOut, false);
  const order = Object.entries(r.completedAt).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  assert.deepEqual(order, ['shelter', 'gravel_garden', 'meditation_hall', 'bell_tower']);
  const total = r.completedAt.bell_tower!;
  console.log(`  pacing (perfect): ${order.map((id) => `${id} ${r.completedAt[id]!.toFixed(0)} s`).join(', ')}; cycles ${r.cycles.map((c) => c.toFixed(0)).join(', ')} s; ${r.gathered} units`);
  assert.ok(r.completedAt.shelter! > 5 && r.completedAt.shelter! < 90, `shelter at ${r.completedAt.shelter!.toFixed(1)} s`);
  for (const c of r.cycles) assert.ok(c < 90, `cycle of ${c.toFixed(1)} s is over the 90 s target`);
  assert.ok(total < 300, `a perfect run takes ${total.toFixed(0)} s`);
});

test('pacing bot (relaxed player): the valley takes several minutes, never a soft-lock', () => {
  const r = runPacingBot(home, ground, { style: 'relaxed' });
  assert.equal(r.timedOut, false);
  const total = r.completedAt.bell_tower!;
  console.log(`  pacing (relaxed): shelter ${r.completedAt.shelter!.toFixed(0)} s, garden ${r.completedAt.gravel_garden!.toFixed(0)} s, hall ${r.completedAt.meditation_hall!.toFixed(0)} s, bell tower ${total.toFixed(0)} s (${(total / 60).toFixed(1)} min); cycles ${r.cycles.map((c) => c.toFixed(0)).join(', ')} s`);
  assert.ok(total > 150 && total < 900, `relaxed run ${total.toFixed(0)} s`);
});
