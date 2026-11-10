// A headless bot that plays the core loop on a place map with the real rules (plan 9.3), like
// Lanternfall's balance bot. It walks to the nearest useful node, gathers, carries everything to the
// site and deposits, until every site is complete, and reports how long the cycles took.
import { MATERIALS } from '../data/gathering';
import type { PlaceDef } from '../data/places';
import { CoreLoop, type GroundQuery } from './loop';
import type { GatherNode } from './nodes';
import { remaining } from './progress';
import { GameState } from './state';
import { makeRng } from '../core/util';

export interface PacingReport {
  /** Seconds of play from spawn until each site was finished, by site id. */
  completedAt: Record<string, number>;
  /** One entry per trip that ended at a site: seconds since the previous trip ended. */
  cycles: number[];
  /** Units gathered in total. */
  gathered: number;
  /** True if the bot ran out of time before finishing (a soft-lock or a layout it can't walk). */
  timedOut: boolean;
}

/**
 * - 'perfect': full stick, straight to the nearest useful node, no pauses (a lower bound).
 * - 'relaxed': a stand-in for a calm first-time player (plan 9.6 pacing): three-quarter stick, a short
 *   look around after each node and each delivery, and now and then a farther node than the nearest.
 *   It still knows where everything is, so a real first visit (finding things, reading, sitting) is longer.
 */
export type BotStyle = 'perfect' | 'relaxed';

export function runPacingBot(place: PlaceDef, ground: GroundQuery, opts: { dt?: number; maxSeconds?: number; style?: BotStyle; seed?: number } = {}): PacingReport {
  const dt = opts.dt ?? 1 / 30;
  const maxSeconds = opts.maxSeconds ?? 1800;
  const relaxed = opts.style === 'relaxed';
  const rng = makeRng(opts.seed ?? 7);
  let pause = 0;
  let wanted: string | null = null;
  const state = new GameState([place]);
  const loop = new CoreLoop(place, ground, state, place.spawn);
  const w = loop.walker;
  const report: PacingReport = { completedAt: {}, cycles: [], gathered: 0, timedOut: false };
  let t = 0;
  let lastCycleEnd = 0;
  let deliveredThisTrip = 0;
  state.on((e) => {
    if (e.type === 'gathered') { report.gathered++; if (relaxed && e.left === 0) pause = 1.2; }
    if (e.type === 'deposited') deliveredThisTrip++;
    if (e.type === 'completed') {
      if (relaxed) pause = 6; // watch the completion and the land respond
      report.completedAt[e.site] = t;
      report.cycles.push(t - lastCycleEnd);
      lastCycleEnd = t;
      deliveredThisTrip = 0;
    }
  });
  // Unsticking: if the bot makes no headway it sidesteps for a moment.
  let stuckFor = 0, sidestep = 0, sideSign = 1;
  let lastX = w.x, lastZ = w.z;

  while (t < maxSeconds) {
    const site = loop.sites.find((s) => !loop.siteComplete(s));
    if (!site) break;
    const need = remaining(site.def, state.deposits[site.id]!);
    const stillToGather = MATERIALS.filter((m) => need[m] - state.satchel[m] > 0 && state.room(m) > 0);
    let goal: { x: number; z: number; r: number };
    if (stillToGather.length === 0 || (loop.sensor.current?.id === `site:${site.id}` && loop.canDeposit(site))) {
      goal = { x: site.x, z: site.z, r: site.def.siteRadius * 0.8 };
    } else {
      // Keep working the node we're at while it still gives what we need.
      const cur = loop.nodes.find((n) => loop.sensor.current?.id === `node:${n.id}`);
      const options = loop.nodes
        .filter((n) => n.canGather && stillToGather.includes(n.def.material))
        .sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z));
      // A relaxed player keeps heading for the node they chose, and sometimes chooses the second nearest.
      const kept: GatherNode | undefined = wanted ? options.find((n) => n.id === wanted) : undefined;
      const choice: GatherNode | undefined = kept ?? (relaxed && options.length > 1 && rng() < 0.35 ? options[1] : options[0]);
      wanted = choice?.id ?? null;
      const pick = cur && cur.canGather && stillToGather.includes(cur.def.material) ? cur : choice;
      goal = pick ? { x: pick.x, z: pick.z, r: pick.def.radius * 0.8 } : { x: w.x, z: w.z, r: 1 }; // wait for regrowth
    }
    const dx = goal.x - w.x, dz = goal.z - w.z, d = Math.hypot(dx, dz);
    let mx = 0, mz = 0;
    if (pause > 0) pause -= dt;
    else if (d > goal.r) {
      const stick = relaxed ? 0.75 : 1;
      mx = (dx / d) * stick; mz = (dz / d) * stick;
      if (sidestep > 0) { sidestep -= dt; const sx = -mz * sideSign, sz = mx * sideSign; mx = sx; mz = sz; }
    }
    const before = state.deposits[site.id]!;
    const beforeTotal = MATERIALS.reduce((s, m) => s + before[m], 0);
    loop.step(dt, { x: mx, z: mz });
    t += dt;

    const moved = Math.hypot(w.x - lastX, w.z - lastZ);
    lastX = w.x; lastZ = w.z;
    if (pause <= 0 && d > goal.r && moved < 0.3 * w.tuning.maxSpeed * dt * (relaxed ? 0.75 : 1)) {
      stuckFor += dt;
      if (stuckFor > 0.4) { sidestep = 0.7; sideSign = -sideSign; stuckFor = 0; }
    } else stuckFor = 0;

    // A trip ends when the bot has emptied what it can into the site.
    const afterTotal = MATERIALS.reduce((s, m) => s + state.deposits[site.id]![m], 0);
    if (deliveredThisTrip > 0 && afterTotal === beforeTotal && !loop.canDeposit(site)) {
      report.cycles.push(t - lastCycleEnd);
      lastCycleEnd = t;
      deliveredThisTrip = 0;
      wanted = null;
      if (relaxed) pause = 2.5; // a look at what just went up
    }
  }
  report.timedOut = loop.sites.some((s) => !loop.siteComplete(s));
  return report;
}
