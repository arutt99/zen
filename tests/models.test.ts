// Model builders run in Node too (three.js geometry needs no browser), so data and builders can't drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorGeo } from '../src/render/decor-models';
import { DECOR_KINDS } from '../src/data/validate';

test('every decor kind the data may use has a builder that makes geometry', () => {
  for (const kind of DECOR_KINDS) {
    const g = decorGeo(kind);
    assert.ok(g.solid.getAttribute('position').count > 0, kind);
    assert.ok(g.solid.getAttribute('color'), `${kind} has vertex colors`);
  }
});

import { BUILDINGS, KIT_STYLES } from '../src/data/buildings';
import { CHARACTER_STYLES } from '../src/data/characters';
import { LOOK_IDS } from '../src/data/looks';
import { CaretakerView } from '../src/render/caretaker';
import { useLook } from '../src/render/look';
import { KIT_PARTS, partGeo } from '../src/render/kits';
import { TreeView, BoulderView } from '../src/render/nodes';
import { GatherNode } from '../src/sim/nodes';
import { initMaterials } from '../src/render/materials';

test('every building part has a model in its kit, in every kit style', () => {
  for (const b of Object.values(BUILDINGS)) {
    assert.ok(KIT_PARTS[b.kit], `${b.id}: unknown kit ${b.kit}`);
    for (const style of KIT_STYLES) {
      for (const p of b.parts) {
        assert.ok(KIT_PARTS[b.kit]!.includes(p.id), `${b.id}: kit ${b.kit} has no part "${p.id}"`);
        assert.ok(partGeo(b.kit, p.id, style).solid.getAttribute('position').count > 0, `${style}/${p.id}`);
      }
    }
  }
});

test('the two kit styles really differ part by part', () => {
  for (const p of BUILDINGS.shelter.parts) {
    const a = partGeo('shelter_kit', p.id, 'temple').solid.getAttribute('position').count;
    const b = partGeo('shelter_kit', p.id, 'timber').solid.getAttribute('position').count;
    assert.notEqual(a, b, p.id);
  }
});

test('the caretaker builds in every style, and outlines follow the look', () => {
  for (const id of LOOK_IDS) {
    useLook(id);
    for (const style of CHARACTER_STYLES) {
      const c = new CaretakerView(style);
      let meshes = 0;
      c.root.traverse((o) => { if ((o as { isMesh?: boolean }).isMesh) meshes++; });
      assert.ok(meshes >= 8, `${id}/${style}: ${meshes} meshes`);
      c.update(1 / 60, 0, 0, 0, 0, 3, { wood: 5, stone: 3 }, null);
    }
  }
  useLook('painted');
});

test('node views lose a visible piece with every unit and come back as they regrow', () => {
  try { initMaterials(); } catch { /* no canvas in Node: materials stay null, meshes still build */ }
  for (const kind of ['tree', 'boulder'] as const) {
    const n = new GatherNode('x', kind, 0, 0);
    const v = kind === 'tree' ? new TreeView(n, 0, 0) : new BoulderView(n, 0, 0);
    const shown = () => {
      let c = 0;
      v.root.traverseVisible((o) => { if ((o as { isMesh?: boolean }).isMesh) c++; });
      return c;
    };
    v.update(1 / 60, 0);
    const counts = [shown()];
    while (n.take() >= 0) {
      for (let i = 0; i < 120; i++) v.update(1 / 60, i / 60);
      counts.push(shown());
    }
    // Trees gain a notch while losing a puff, so compare against the full node, and the end state.
    assert.ok(counts[counts.length - 1]! < counts[0]!, `${kind}: ${counts.join(' → ')}`);
    n.update(1000);
    for (let i = 0; i < 600; i++) v.update(1 / 60, i / 60);
    assert.equal(shown(), counts[0], `${kind} grows back to full`);
  }
});
