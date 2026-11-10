import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, damp, hashString, rng } from '../src/core/util';
import { freshSave, loadSave, parseSave, SAVE_KEY, SAVE_VERSION, serializeSave, writeSave, type KeyValueStore } from '../src/core/save';
import { defaultTier } from '../src/data/quality';

const memStore = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
};

test('rng is deterministic per seed and stays in [0, 1)', () => {
  const a = rng(7), b = rng(7), c = rng(8);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
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
  s.settings = { quality: 'high', sound: false };
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
  const { data, recovered } = parseSave(JSON.stringify({ v: 1, at: { place: 'home_valley', x: 'east', z: 2 }, settings: { quality: 'insane', sound: true } }));
  assert.equal(recovered, null);
  assert.equal(data.at.x, freshSave().at.x);
  assert.equal(data.at.z, 2);
  assert.equal(data.settings.quality, 'auto');
});

test('storage that throws never crashes the game', () => {
  const broken: KeyValueStore = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
  assert.ok(loadSave(broken).recovered);
  assert.equal(writeSave(broken, freshSave()), false);
  assert.equal(serializeSave(freshSave()).includes(SAVE_KEY), false);
});

test('phones default to Medium or Low, strong desktops to High', () => {
  assert.equal(defaultTier({ coarsePointer: true, deviceMemoryGb: 4, hardwareConcurrency: 8, screenMinSide: 390 }), 'medium');
  assert.equal(defaultTier({ coarsePointer: true, deviceMemoryGb: 2, hardwareConcurrency: 4, screenMinSide: 360 }), 'low');
  assert.equal(defaultTier({ coarsePointer: true, hardwareConcurrency: 4, screenMinSide: 390 }), 'medium');
  assert.equal(defaultTier({ coarsePointer: false, deviceMemoryGb: 8, hardwareConcurrency: 12, screenMinSide: 1080 }), 'high');
  assert.equal(defaultTier({ coarsePointer: false, screenMinSide: 800 }), 'medium');
});
