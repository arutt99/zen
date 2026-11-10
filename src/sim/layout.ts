// Deterministic scatter of trees and rocks for a place, shared by render (to draw them) and sim
// (to collide with them). Pure data from the place definition + seed, so tests can check it.

import { rng } from '../core/util';
import type { PlaceDef } from '../data/places';
import type { Blocker } from './walker';

export interface Scattered { kind: 'tree' | 'pine' | 'rock'; x: number; z: number; scale: number; rot: number; seed: number }

export function scatterPlace(place: PlaceDef): Scattered[] {
  const rand = rng(place.seed);
  const out: Scattered[] = [];
  const avoid = [{ ...place.pond, r: place.pond.r + 1.5 }, ...place.clearings, ...place.props.map((p) => ({ x: p.x, z: p.z, r: 2 }))];
  const free = (x: number, z: number, r: number) =>
    avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r + r) && out.every((o) => Math.hypot(x - o.x, z - o.z) > 1.8 + r);
  const place1 = (kind: Scattered['kind'], count: number, minR: number, maxR: number, size: number) => {
    let tries = 0;
    let made = 0;
    while (made < count && tries < count * 40) {
      tries++;
      const a = rand() * Math.PI * 2;
      const d = minR + Math.sqrt(rand()) * (maxR - minR);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!free(x, z, size)) continue;
      out.push({ kind, x, z, scale: 0.8 + rand() * 0.5, rot: rand() * Math.PI * 2, seed: Math.floor(rand() * 1e9) });
      made++;
    }
  };
  const edge = place.islandRadius;
  // Trees cluster toward the rim so the middle stays open garden space (plan 7.1: room to walk).
  place1('tree', Math.ceil(place.treeCount * 0.55), edge * 0.45, edge - 2, 1.2);
  place1('pine', Math.floor(place.treeCount * 0.45), edge * 0.55, edge - 1.5, 1.0);
  place1('rock', place.rockCount, 3, edge - 1.5, 0.6);
  return out;
}

/** Collision circles for the walker: pond, trunks, rocks, benches. */
export function blockersFor(place: PlaceDef, scattered: readonly Scattered[]): Blocker[] {
  const b: Blocker[] = [{ x: place.pond.x, z: place.pond.z, r: place.pond.r - 0.4 }];
  for (const s of scattered) b.push({ x: s.x, z: s.z, r: s.kind === 'rock' ? 0.55 * s.scale : 0.35 * s.scale });
  for (const p of place.props) {
    if (p.kind === 'cherry' || p.kind === 'pine') b.push({ x: p.x, z: p.z, r: 0.4 });
    if (p.kind === 'rock') b.push({ x: p.x, z: p.z, r: 0.6 });
    if (p.kind === 'bench') b.push({ x: p.x, z: p.z, r: 0.6 });
  }
  return b;
}
