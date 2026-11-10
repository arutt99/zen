import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, damp, hashString, makeRng } from '../src/core/util';
import { freshSave, loadSave, parseSave, SAVE_KEY, SAVE_VERSION, serializeSave, writeSave, type KeyValueStore } from '../src/core/save';
import { defaultTier } from '../src/data/quality';

const memStore = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
};

test('rng is deterministic per seed and stays in [0, 1)', () => {
  const a = makeRng(7), b = makeRng(7), c = makeRng(8);
  const take = (r: () => number) => Array.from({ length: 50 }, () => r());
  const sa = take(a), sb = take(b), sc = take(c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const v of sa) assert.ok(v >= 0 && v < 1);
});

test('hashString and clamp/damp basics', () => {
  assert.equal(hashString('moss'), hashString('moss'));
  assert.notEqual(hashString('moss'), hashString('bell'));
  assert.equal(clamp(5, 0, 1), 1);
  const d = damp(0, 10, 5, 1 / 60);
  assert.ok(d > 0 && d < 10);
  // Frame-rate independence: two half steps ≈ one full step.
  assert.ok(Math.abs(damp(damp(0, 10, 5, 0.05), 10, 5, 0.05) - damp(0, 10, 5, 0.1)) < 1e-9);
});

test('save round trip keeps every fact', () => {
  const store = memStore();
  const s = freshSave();
  s.at = { place: 'home_valley', x: 3.25, z: -1.5 };
  s.settings = { quality: 'high', sound: false, camera: 'b', scale: 's' };
  s.satchel = { wood: 3, stone: 1 };
  s.deposits = { shelter: { wood: 4 } };
  assert.ok(writeSave(store, s));
  const { data, recovered } = loadSave(store);
  assert.equal(recovered, null);
  assert.deepEqual(data, s);
});

test('missing save gives a fresh save without a warning', () => {
  const { data, recovered } = loadSave(memStore());
  assert.equal(recovered, null);
  assert.deepEqual(data, freshSave());
});

test('corrupt save falls back to fresh and says why', () => {
  for (const raw of ['{not json', '[]', '"text"', 'null', '42']) {
    const { data, recovered } = parseSave(raw);
    assert.deepEqual(data, freshSave(), raw);
    assert.ok(recovered, `expected a recovery reason for ${raw}`);
  }
});

test('future or bad versions fall back instead of crashing', () => {
  assert.ok(parseSave(JSON.stringify({ v: SAVE_VERSION + 1 })).recovered);
  assert.ok(parseSave(JSON.stringify({ v: 'one' })).recovered);
});

test('partially bad fields are repaired field by field', () => {
  const { data, recovered } = parseSave(JSON.stringify({
    v: 2, at: { place: 'home_valley', x: 'east', z: 2 }, settings: { quality: 'insane', sound: true, camera: 7 },
    satchel: { wood: 'lots', stone: 2.7, 'bad key!': 3, moss: -1 }, deposits: { shelter: { wood: 4 }, ghost: 'x', empty: {} },
  }));
  assert.equal(recovered, null);
  assert.equal(data.at.x, freshSave().at.x);
  assert.equal(data.at.z, 2);
  assert.equal(data.settings.quality, 'auto');
  assert.equal(data.settings.camera, 'a');
  assert.deepEqual(data.satchel, { stone: 2 });
  assert.deepEqual(data.deposits, { shelter: { wood: 4 } });
});

test('a Phase 0 (v1) save migrates: position and settings kept, empty satchel and deposits', () => {
  const v1 = { v: 1, at: { place: 'home_valley', x: 4, z: -2 }, settings: { quality: 'low', sound: false } };
  const { data, recovered } = parseSave(JSON.stringify(v1));
  assert.equal(recovered, null);
  assert.equal(data.v, SAVE_VERSION);
  assert.deepEqual(data.at, v1.at);
  assert.deepEqual([data.settings.quality, data.settings.sound, data.settings.camera], ['low', false, 'a']);
  assert.deepEqual([data.satchel, data.deposits], [{}, {}]);
});

test('storage that throws never crashes the game', () => {
  const broken: KeyValueStore = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
  assert.ok(loadSave(broken).recovered);
  assert.equal(writeSave(broken, freshSave()), false);
  assert.equal(serializeSave(freshSave()).includes(SAVE_KEY), false);
});

test('phones default to Medium unless clearly weak; GPU rules follow Lanternfall', () => {
  assert.equal(defaultTier({ coarsePointer: true, deviceMemoryGb: 4, hardwareConcurrency: 8 }), 'medium');
  assert.equal(defaultTier({ coarsePointer: true, hardwareConcurrency: 4 }), 'medium');
  assert.equal(defaultTier({ coarsePointer: true, deviceMemoryGb: 2, hardwareConcurrency: 4 }), 'low');
  assert.equal(defaultTier({ coarsePointer: false, gpu: 'angle (google, swiftshader device)' }), 'low');
  assert.equal(defaultTier({ coarsePointer: false, gpu: 'intel(r) uhd graphics 620' }), 'medium');
  assert.equal(defaultTier({ coarsePointer: false, gpu: 'nvidia geforce rtx 3060' }), 'high');
});
