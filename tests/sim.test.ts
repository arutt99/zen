import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDeadZone, combineMoves } from '../src/sim/input';
import { pickTarget, PRIORITY, ProximitySensor, type Proximate } from '../src/sim/proximity';
import { Walker, type WalkArea } from '../src/sim/walker';
import { IslandWorld } from '../src/sim/island';
import { PLACES } from '../src/data/places';
import { validateData } from '../src/data/validate';
import { pentatonicHz } from '../src/audio/sfx-recipes';

const prox = (id: string, priority: number, x: number, z: number, radius = 2, available = true): Proximate & { log: string[] } => {
  const log: string[] = [];
  return {
    id, priority, x, z, radius, kind: 'context', log,
    isAvailable: () => available,
    onEnter: () => void log.push('enter'),
    onTick: () => void log.push('tick'),
    onExit: () => void log.push('exit'),
  };
};

const open = (r = 100): WalkArea => ({ walkable: (x, z) => Math.hypot(x, z) < r, blockers: [] });
const home = new IslandWorld(PLACES.home_valley);
const homeArea: WalkArea = { walkable: (x, z) => home.walkable(x, z), blockers: home.solids };

test('combineMoves takes the strongest source and clamps diagonals', () => {
  const m = combineMoves({ x: 1, z: -1 }, { x: 0.2, z: 0 });
  assert.ok(Math.abs(Math.hypot(m.x, m.z) - 1) < 1e-9);
  assert.deepEqual(combineMoves({ x: 0, z: 0 }, { x: 0.5, z: 0 }), { x: 0.5, z: 0 });
});

test('dead zone removes drift and rescales the rest', () => {
  assert.deepEqual(applyDeadZone({ x: 0.1, z: 0.05 }), { x: 0, z: 0 });
  assert.ok(Math.abs(applyDeadZone({ x: 1, z: 0 }).x - 1) < 1e-9);
});

test('proximity picks higher priority over nearer, then nearest', () => {
  const near = prox('near', PRIORITY.context, 0.5, 0);
  const site = prox('site', PRIORITY.buildSite, 1.5, 0);
  const node = prox('node', PRIORITY.gatherNode, 1, 0);
  assert.equal(pickTarget(0, 0, [near, node, site])?.id, 'site');
  assert.equal(pickTarget(0, 0, [near, node])?.id, 'node');
  const a = prox('a', PRIORITY.context, 1.5, 0), b = prox('b', PRIORITY.context, 0.4, 0);
  assert.equal(pickTarget(0, 0, [a, b])?.id, 'b');
});

test('proximity ignores unavailable and out-of-range targets', () => {
  assert.equal(pickTarget(0, 0, [prox('off', 999, 0, 0, 2, false), prox('far', 1, 9, 0)]), null);
});

test('sensor calls enter, tick and exit in order', () => {
  const t = prox('t', PRIORITY.context, 0, 0);
  const s = new ProximitySensor();
  s.update(0, 0, [t], 0.016);
  s.update(0, 0, [t], 0.016);
  s.update(10, 0, [t], 0.016);
  assert.deepEqual(t.log, ['enter', 'tick', 'tick', 'exit']);
});

test('walker accelerates to max speed and stops when released', () => {
  const w = new Walker(0, 0);
  for (let i = 0; i < 60; i++) w.step(1 / 60, { x: 1, z: 0 }, open());
  assert.ok(Math.abs(w.speed - w.tuning.maxSpeed) < 1e-6);
  assert.ok(w.x > 2);
  for (let i = 0; i < 60; i++) w.step(1 / 60, { x: 0, z: 0 }, open());
  assert.equal(w.speed, 0);
});

test('walker stops at unwalkable ground and stays out of blockers', () => {
  const w = new Walker(0, 0);
  for (let i = 0; i < 300; i++) w.step(1 / 60, { x: 1, z: 0 }, open(5));
  assert.ok(Math.hypot(w.x, w.z) < 5);
  const area: WalkArea = { walkable: () => true, blockers: [{ x: 0, z: -3, r: 1 }] };
  const w2 = new Walker(0, 0);
  for (let i = 0; i < 300; i++) w2.step(1 / 60, { x: 0, z: -1 }, area);
  assert.ok(Math.hypot(w2.x, w2.z + 3) >= 1 + w2.tuning.radius - 1e-6);
});

test('walker ignores zero, negative and NaN frame times', () => {
  const w = new Walker(1, 2);
  for (const dt of [0, -0.01, Number.NaN]) w.step(dt, { x: 1, z: 0 }, open());
  assert.deepEqual([w.x, w.z, w.vx, w.vz], [1, 2, 0, 0]);
});

test('game data validates cleanly', () => {
  assert.deepEqual(validateData(), []);
});

test('the home island is deterministic', () => {
  const again = new IslandWorld(PLACES.home_valley);
  assert.deepEqual(again.blockers, home.blockers);
  assert.equal(again.height(3.3, -4.1), home.height(3.3, -4.1));
});

test('the home island has a pond, a path, a rim and enough trees', () => {
  const p = PLACES.home_valley;
  assert.ok(home.height(p.pond.x, p.pond.z) < home.waterLevel, 'pond centre is under water');
  assert.ok(home.roadDistance(p.path[2]![0], p.path[2]![1]) < 0.5, 'path control points lie on the path');
  assert.ok(home.height(home.extW, home.extH) < -10, 'the island falls away at its corners');
  assert.equal(home.walkable(p.pond.x, p.pond.z), false);
  assert.ok(home.blockers.filter((b) => b.kind !== 'rock').length > 40, 'groves of trees around the valley');
  assert.ok(home.blockers.filter((b) => b.kind === 'rock').length >= p.rocks * 0.7);
});

test('spawn is walkable and clear of trunks and rocks', () => {
  const p = PLACES.home_valley;
  assert.ok(home.walkable(p.spawn.x, p.spawn.z));
  assert.ok(home.solids.every((b) => Math.hypot(p.spawn.x - b.x, p.spawn.z - b.z) > b.r + 0.35));
});

test('walker can walk from spawn to the bench sit spot', () => {
  // A crude steering bot: head toward the bench and see if we get within the sit radius.
  const p = PLACES.home_valley;
  const bench = p.props.find((q) => q.kind === 'bench')!;
  const w = new Walker(p.spawn.x, p.spawn.z);
  for (let i = 0; i < 60 * 20; i++) {
    const dx = bench.x - w.x, dz = bench.z + 1.2 - w.z, d = Math.hypot(dx, dz);
    if (d < 0.3) break;
    w.step(1 / 60, { x: dx / d, z: dz / d }, homeArea);
  }
  assert.ok(Math.hypot(bench.x - w.x, bench.z - w.z) < 2.1, `ended at ${w.x.toFixed(1)}, ${w.z.toFixed(1)}`);
});

test('walking the whole path never leaves walkable ground', () => {
  const road = home.roads[0]!;
  const s = { x: 0, z: 0, dx: 0, dz: 0 };
  for (let d = 0; d <= road.length; d += 0.5) {
    road.sample(d, s);
    if (Math.abs(s.x) < home.halfW && Math.abs(s.z) < home.halfH) assert.ok(home.walkable(s.x, s.z), `path at ${d} m`);
  }
});

test('pentatonic notes rise and repeat at the octave', () => {
  assert.ok(Math.abs(pentatonicHz(5, 200) - 400) < 1e-9);
  for (let i = 0; i < 10; i++) assert.ok(pentatonicHz(i + 1) > pentatonicHz(i));
});
