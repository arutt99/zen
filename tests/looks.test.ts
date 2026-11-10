// Lanternfall+ (A6): baked occlusion, contact shadows and the rich detail pass, switched on by the look
// and off in plain Lanternfall.
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

test('only the decided look and its light fallback remain (A6, Phase 3 cleanup)', () => {
  assert.deepEqual([...LOOK_IDS], ['lanternfallplus', 'lanternfall']);
  assert.equal(LOOKS.lanternfall.detail, 'base');
  assert.equal(LOOKS.lanternfall.light.ao, 0);
  assert.equal(LOOKS.lanternfall.light.contact, 0);
});

test('baked occlusion darkens where parts meet and near the ground, and leaves open faces alone', () => {
  useLook('lanternfall'); // no bake inside MB.build: the test bakes by hand
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

test('lanternfall+ builds finer models than plain lanternfall: rounder stones, clustered crowns, a finer lantern', () => {
  const count = (g: THREE.BufferGeometry) => g.getAttribute('position').count;
  const base: Record<string, number> = {}, finer: Record<string, number> = {};
  useLook('lanternfall');
  for (const k of ['oak', 'rock', 'stone_lantern']) base[k] = count(decorGeo(k).solid) + (decorGeo(k).leaf ? count(decorGeo(k).leaf!) : 0);
  const roofBase = count(partGeo('shelter_kit', 'roof', 'temple').solid);
  useLook('lanternfallplus');
  for (const k of ['oak', 'rock', 'stone_lantern']) finer[k] = count(decorGeo(k).solid) + (decorGeo(k).leaf ? count(decorGeo(k).leaf!) : 0);
  const roofFine = count(partGeo('shelter_kit', 'roof', 'temple').solid);
  for (const k of Object.keys(base)) assert.ok(finer[k]! > base[k]!, `${k}: ${base[k]} → ${finer[k]}`);
  assert.ok(roofFine > roofBase, `temple roof: ${roofBase} → ${roofFine}`);
  assert.ok(finer.oak! < 80000, `oak vertices ${finer.oak}`);
  useLook('lanternfall');
});

test('lanternfall+ rich detail: inked marks, leafy crowns, a swaying lantern, dressing and lantern light', async () => {
  const { dressingPlan, staticLamps, DRESS_KINDS } = await import('../src/render/rich');
  const { IslandWorld } = await import('../src/sim/island');
  const { PLACES } = await import('../src/data/places');
  const count = (g: THREE.BufferGeometry) => g.getAttribute('position').count;
  useLook('lanternfallplus');
  const oak = decorGeo('oak');
  // Trunks carry bark marks; the kit's posts wood; stones stone.
  const codes = (g: THREE.BufferGeometry) => new Set(Array.from({ length: count(g) }, (_, i) => g.getAttribute('aMark').getW(i)));
  assert.ok(codes(oak.solid).has(3), 'bark on the trunk');
  assert.ok(codes(decorGeo('rock').solid).has(4), 'stone on rocks');
  assert.ok(codes(partGeo('shelter_kit', 'post_back_left', 'temple').solid).has(2), 'wood on posts');
  const roof = partGeo('shelter_kit', 'roof', 'temple');
  assert.ok(roof.swing && count(roof.swing.glow) > 0, 'the hanging lantern is its own swaying piece');
  const world = new IslandWorld(PLACES.home_valley);
  const plan = dressingPlan(world);
  for (const k of DRESS_KINDS) assert.ok(plan[k].mats.length > 0, `dressing ${k}`);
  assert.ok(plan.edge.mats.length > 60, `path edging ${plan.edge.mats.length}`);
  // Nothing dressed inside a build site.
  const site = PLACES.home_valley.sites[0]!;
  const p = new THREE.Vector3();
  for (const k of DRESS_KINDS) for (const m of plan[k].mats) assert.ok(Math.hypot(p.setFromMatrixPosition(m).x - site.x, p.z - site.z) > 3, `${k} clear of the site`);
  assert.ok(staticLamps(world).length >= 2, 'stone lanterns light the night');
  useLook('lanternfall');
  assert.equal(decorGeo('rock').solid.getAttribute('aMark'), undefined, 'no marks in plain lanternfall');
});
