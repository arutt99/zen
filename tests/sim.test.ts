import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDeadZone, combineMoves } from '../src/sim/input';
import { pickTarget, PRIORITY, ProximitySensor, type Proximate } from '../src/sim/proximity';
import { Walker } from '../src/sim/walker';
import { blockersFor, scatterPlace } from '../src/sim/layout';
import { PLACES } from '../src/data/places';
import { validateData } from '../src/data/validate';
import { pentatonicHz } from '../src/audio/audio';

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

test('combineMoves takes the strongest source and clamps diagonals', () => {
  const m = combineMoves({ x: 1, z: -1 }, { x: 0.2, z: 0 });
  assert.ok(Math.abs(Math.hypot(m.x, m.z) - 1) < 1e-9);
  assert.deepEqual(combineMoves({ x: 0, z: 0 }, { x: 0.5, z: 0 }), { x: 0.5, z: 0 });
});

test('dead zone removes drift and rescales the rest', () => {
  assert.deepEqual(applyDeadZone({ x: 0.1, z: 0.05 }), { x: 0, z: 0 });
  const full = applyDeadZone({ x: 1, z: 0 });
  assert.ok(Math.abs(full.x - 1) < 1e-9);
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
  const area = { boundsRadius: 100, blockers: [] };
  for (let i = 0; i < 60; i++) w.step(1 / 60, { x: 1, z: 0 }, area);
  assert.ok(Math.abs(w.speed - w.tuning.maxSpeed) < 1e-6);
  assert.ok(w.x > 2);
  for (let i = 0; i < 60; i++) w.step(1 / 60, { x: 0, z: 0 }, area);
  assert.equal(w.speed, 0);
});

test('walker stays on the island and out of blockers', () => {
  const w = new Walker(0, 0);
  const area = { boundsRadius: 5, blockers: [{ x: 0, z: -3, r: 1 }] };
  for (let i = 0; i < 300; i++) w.step(1 / 60, { x: 1, z: 0 }, area);
  assert.ok(Math.hypot(w.x, w.z) <= 5 - w.tuning.radius + 1e-6);
  const w2 = new Walker(0, 0);
  for (let i = 0; i < 300; i++) w2.step(1 / 60, { x: 0, z: -1 }, area);
  assert.ok(Math.hypot(w2.x, w2.z + 3) >= 1 + w2.tuning.radius - 1e-6);
});

test('game data validates cleanly', () => {
  assert.deepEqual(validateData(), []);
});

test('home island scatter is deterministic and leaves the spawn and bench walkable', () => {
  const place = PLACES.home_valley;
  const a = scatterPlace(place), b = scatterPlace(place);
  assert.deepEqual(a, b);
  assert.ok(a.filter((s) => s.kind !== 'rock').length >= place.treeCount * 0.8, 'most trees should find a spot');
  const blockers = blockersFor(place, a);
  const clear = (x: number, z: number) => blockers.every((bl) => Math.hypot(x - bl.x, z - bl.z) > bl.r + 0.35);
  assert.ok(clear(place.spawn.x, place.spawn.z), 'spawn must not be inside a blocker');
  const bench = place.props.find((p) => p.kind === 'bench')!;
  assert.ok(clear(bench.x, bench.z + 1.2), 'the bench must be reachable from the front');
});

test('walker can walk from spawn to the bench sit spot', () => {
  // A crude steering bot: head toward the bench and see if we get within the sit radius.
  const place = PLACES.home_valley;
  const area = { boundsRadius: place.islandRadius - 1, blockers: blockersFor(place, scatterPlace(place)) };
  const bench = place.props.find((p) => p.kind === 'bench')!;
  const w = new Walker(place.spawn.x, place.spawn.z);
  for (let i = 0; i < 60 * 15; i++) {
    const dx = bench.x - w.x, dz = bench.z + 1 - w.z, d = Math.hypot(dx, dz);
    if (d < 0.3) break;
    w.step(1 / 60, { x: dx / d, z: dz / d }, area);
  }
  assert.ok(Math.hypot(bench.x - w.x, bench.z - w.z) < 1.9);
});

test('pentatonic notes rise and repeat at the octave', () => {
  assert.ok(Math.abs(pentatonicHz(5, 200) - 400) < 1e-9);
  for (let i = 0; i < 10; i++) assert.ok(pentatonicHz(i + 1) > pentatonicHz(i));
});

test('walker ignores zero, negative and NaN frame times', () => {
  const w = new Walker(1, 2);
  const area = { boundsRadius: 100, blockers: [] };
  for (const dt of [0, -0.01, Number.NaN]) w.step(dt, { x: 1, z: 0 }, area);
  assert.deepEqual([w.x, w.z, w.vx, w.vz], [1, 2, 0, 0]);
});
