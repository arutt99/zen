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
