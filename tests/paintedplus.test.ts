// Painted+ (owner request 2026-11-10): Painted nudged toward a soft-lit diorama. Baked occlusion,
// contact shadows and a detail pass, all switched on by the look and off in every other look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LOOKS, LOOK_IDS } from '../src/data/looks';
import { bakeAO } from '../src/render/ao';
import { contactField } from '../src/render/contact';
import { decorGeo } from '../src/render/decor-models';
import { partGeo } from '../src/render/kits';
import { useLook } from '../src/render/look';
import { MB } from '../src/render/mb';

test('painted+ keeps painted\'s warmth but adds soft light and detail; other looks are unchanged', () => {
  const p = LOOKS.painted, pp = LOOKS.paintedplus;
  assert.equal(pp.detail, 'fine');
  assert.ok(pp.light.ao > 0 && pp.light.contact > 0 && pp.light.shadowSoftness > p.light.shadowSoftness);
  assert.deepEqual([...pp.outline.on], ['figure'], 'lines on figures only');
  assert.ok(pp.outline.width < p.outline.width);
  assert.ok(pp.shading.softness >= p.shading.softness, 'at least as soft');
  assert.ok(pp.shading.shadowTint[0] >= pp.shading.shadowTint[2], 'warm shadow tint');
  for (const id of LOOK_IDS) if (id !== 'paintedplus' && id !== 'lanternfallplus') {
    assert.equal(LOOKS[id].detail, 'base', id);
    assert.equal(LOOKS[id].light.ao, 0, id);
    assert.equal(LOOKS[id].light.contact, 0, id);
  }
});

test('lanternfall+ is lanternfall\'s shading, lines and color with painted+\'s light and detail', () => {
  const l = LOOKS.lanternfall, lp = LOOKS.lanternfallplus, pp = LOOKS.paintedplus;
  assert.deepEqual(lp.shading, l.shading, 'crisp bands');
  assert.deepEqual(lp.outline, l.outline, 'ink on everything');
  assert.deepEqual(lp.albedo, l.albedo, 'rich color');
  assert.deepEqual(lp.post, l.post, 'no grain');
  assert.deepEqual(lp.haze, l.haze, 'no haze');
  assert.deepEqual(lp.ground, l.ground);
  assert.equal(lp.detail, pp.detail);
  assert.ok(lp.light.ao > 0 && lp.light.contact > 0);
});

test('baked occlusion darkens where parts meet and near the ground, and leaves open faces alone', () => {
  useLook('painted'); // no bake inside MB.build: the test bakes by hand
  const g = new MB().box(1, 1, 1, 0xffffff, { p: [0, 0.5, 0] }).box(0.2, 1, 0.2, 0xffffff, { p: [0, 1.5, 0] }).build();
  bakeAO(g, 1, { ground: true });
  const pos = g.getAttribute('position'), col = g.getAttribute('color'), nrm = g.getAttribute('normal');
  let foot = 1, top = 0, postFoot = 1;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), c = col.getY(i), side = Math.abs(nrm.getY(i)) < 0.5;
    if (side && y < 0.05 && Math.abs(pos.getX(i)) > 0.45) foot = Math.min(foot, c); // cube's sides at the ground
    if (nrm.getY(i) > 0.9 && y > 0.99 && y < 1.01 && Math.abs(pos.getX(i)) > 0.45) top = Math.max(top, c); // open corners of the cube top
    if (side && y > 0.999 && y < 1.05) postFoot = Math.min(postFoot, c); // post where it meets the cube
  }
  assert.ok(foot < 0.9, `sides darken at the ground (${foot})`);
  assert.ok(postFoot < 0.9, `post darkens where it meets the cube (${postFoot})`);
  assert.ok(top > 0.97, `open top corners stay bright (${top})`);
  assert.ok(col.getX(0) >= col.getZ(0), 'warm, not grey');
});

test('contact shadows paint soft footprints that combine without going black', () => {
  const f = contactField(4, 4, [{ x: 0, z: 0, hx: 0.5, hz: 0.5, rot: 0, k: 0.9 }, { x: 0.2, z: 0, hx: 0.5, hz: 0.5, rot: 0, k: 0.9 }, { x: 2, z: 2, hx: 1, hz: 1, rot: 0, k: 0.8, site: true }]);
  const at = (x: number, z: number, ch: number) => f.data[(Math.round((z + 4) * 4) * f.w + Math.round((x + 4) * 4)) * 4 + ch]!;
  assert.ok(at(0, 0, 0) > 200 && at(0, 0, 0) < 255, 'dark under the props, never fully black');
  assert.equal(at(-3.5, -3.5, 0), 0, 'clear away from them');
  assert.ok(at(2, 2, 1) > 150 && at(2, 2, 0) === 0, 'sites go in their own channel');
});

test('painted+ builds finer models: rounder stones, clustered crowns, a finer lantern and shelter', () => {
  const count = (g: THREE.BufferGeometry) => g.getAttribute('position').count;
  const base: Record<string, number> = {}, finer: Record<string, number> = {};
  useLook('painted');
  for (const k of ['oak', 'rock', 'stone_lantern']) base[k] = count(decorGeo(k).solid) + (decorGeo(k).leaf ? count(decorGeo(k).leaf!) : 0);
  const roofBase = count(partGeo('shelter_kit', 'roof', 'temple').solid);
  useLook('paintedplus');
  for (const k of ['oak', 'rock', 'stone_lantern']) finer[k] = count(decorGeo(k).solid) + (decorGeo(k).leaf ? count(decorGeo(k).leaf!) : 0);
  const roofFine = count(partGeo('shelter_kit', 'roof', 'temple').solid);
  for (const k of Object.keys(base)) assert.ok(finer[k]! > base[k]!, `${k}: ${base[k]} → ${finer[k]}`);
  assert.ok(roofFine > roofBase, `temple roof: ${roofBase} → ${roofFine}`);
  // Budget: a clustered oak stays well under what a phone can instance a few dozen times.
  assert.ok(finer.oak! < 60000, `oak vertices ${finer.oak}`);
  useLook('painted');
});
