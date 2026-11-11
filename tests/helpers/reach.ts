// Flood fill over walkable ground (0.5 m cells), minus fixed solids and given extra blockers, so tests can
// check that arrivals, exits, sites, nodes and sit spots are all reachable from where a player starts.
import type { PlaceDef } from '../../src/data/places';
import { IslandWorld } from '../../src/sim/island';

export interface Reach { world: IslandWorld; reachable(x: number, z: number, slack?: number): boolean }

export function reachFrom(place: PlaceDef, start: { x: number; z: number }, extra: { x: number; z: number; r: number }[] = [], world = new IslandWorld(place)): Reach {
  const S = 0.5;
  const solids = [...world.solids, ...extra, ...place.nodes.map((n) => ({ x: n.x, z: n.z, r: n.kind === 'boulder' ? 0.8 : 0.5 }))];
  const W = Math.ceil((place.halfW + 2) / S), H = Math.ceil((place.halfH + 2) / S);
  const key = (i: number, j: number) => (j + H) * (2 * W + 1) + (i + W);
  const free = (i: number, j: number) => {
    const x = i * S, z = j * S;
    return world.walkable(x, z) && solids.every((b) => Math.hypot(b.x - x, b.z - z) > b.r + 0.3);
  };
  const seen = new Set<number>();
  const si = Math.round(start.x / S), sj = Math.round(start.z / S);
  const queue: [number, number][] = [[si, sj]];
  seen.add(key(si, sj));
  while (queue.length) {
    const [i, j] = queue.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const a = i + di, b = j + dj;
      if (Math.abs(a) > W || Math.abs(b) > H || seen.has(key(a, b)) || !free(a, b)) continue;
      seen.add(key(a, b));
      queue.push([a, b]);
    }
  }
  return {
    world,
    reachable(x, z, slack = 0) {
      // True if any reached cell lies within `slack` (+ half a cell) of the point.
      const r = Math.ceil((slack + S) / S);
      const ci = Math.round(x / S), cj = Math.round(z / S);
      for (let a = ci - r; a <= ci + r; a++) for (let b = cj - r; b <= cj + r; b++) {
        if (seen.has(key(a, b)) && Math.hypot(a * S - x, b * S - z) <= slack + S) return true;
      }
      return false;
    },
  };
}
