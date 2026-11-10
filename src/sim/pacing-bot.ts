// A headless bot that plays the core loop on a place map with the real rules (plan 9.3), like
// Lanternfall's balance bot. It walks to the nearest useful node, gathers, carries everything to the
// site and deposits, until every open site is complete, and reports how long the cycles took.
// Phase 4: `runJourneyBot` plays the first journey across places (home → trail → grove → home), carrying
// bamboo back for the tea house, with the same rules and one GameState throughout.
import { BUILDINGS } from '../data/buildings';
import { MATERIALS, type MaterialId } from '../data/gathering';
import type { PlaceDef } from '../data/places';
import { CoreLoop, type GroundQuery } from './loop';
import type { GatherNode } from './nodes';
import { remaining } from './progress';
import { emptyBag, GameState, type Bag } from './state';
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

export interface BotOptions { dt?: number; maxSeconds?: number; style?: BotStyle; seed?: number }

/** One leg of play in one place: build what's open, optionally gather extra to carry away, then optionally walk out. */
interface Leg {
  place: PlaceDef;
  ground: GroundQuery;
  start: { x: number; z: number };
  /** Gather this much more (beyond what the open sites need) before finishing the leg. */
  carry?: Partial<Bag>;
  /** Walk into this exit at the end. */
  leaveBy?: string;
}

class Bot {
  t = 0;
  report: PacingReport = { completedAt: {}, cycles: [], gathered: 0, timedOut: false };
  private rng: ReturnType<typeof makeRng>;
  private relaxed: boolean;
  private dt: number;
  private pause = 0;
  private lastCycleEnd = 0;
  private deliveredThisTrip = 0;

  constructor(readonly state: GameState, private opts: BotOptions) {
    this.rng = makeRng(opts.seed ?? 7);
    this.relaxed = opts.style === 'relaxed';
    this.dt = opts.dt ?? 1 / 30;
    state.on((e) => {
      if (e.type === 'gathered') { this.report.gathered++; if (this.relaxed && e.left === 0) this.pause = 1.2; }
      if (e.type === 'deposited') this.deliveredThisTrip++;
      if (e.type === 'completed') {
        if (this.relaxed) this.pause = 6; // watch the completion and the land respond
        this.report.completedAt[e.site] = this.t;
        this.report.cycles.push(this.t - this.lastCycleEnd);
        this.lastCycleEnd = this.t;
        this.deliveredThisTrip = 0;
      }
    });
  }

  /** Plays one leg. Returns false if it ran out of time. */
  play(leg: Leg): boolean {
    const { state, dt, relaxed } = this;
    const loop = new CoreLoop(leg.place, leg.ground, state, leg.start);
    const maxT = this.opts.maxSeconds ?? 1800;
    const w = loop.walker;
    let wanted: string | null = null;
    let stuckFor = 0, sidestep = 0, sideSign = 1;
    let lastX = w.x, lastZ = w.z;
    const exit = leg.place.exits.find((e) => e.id === leg.leaveBy);
    let left = false;
    loop.onLeave = (e) => { if (e === exit) left = true; };
    const extraLeft = (m: MaterialId) => Math.max(0, (leg.carry?.[m] ?? 0) - state.satchel[m]);
    try {
      while (this.t < maxT) {
        const site = loop.sites.find((s) => !loop.siteComplete(s) && loop.siteOpen(s));
        const need: Bag = site ? remaining(site.def, state.deposits[site.id]!) : emptyBag();
        // Gather for the site, then (with nothing left to build) whatever the leg carries away.
        const toGather = site
          ? MATERIALS.filter((m) => need[m] - state.satchel[m] > 0 && state.room(m) > 0)
          : MATERIALS.filter((m) => extraLeft(m) > 0 && state.room(m) > 0);
        let goal: { x: number; z: number; r: number };
        if (site && (toGather.length === 0 || (loop.sensor.current?.id === `site:${site.id}` && loop.canDeposit(site)))) {
          goal = { x: site.x, z: site.z, r: site.def.siteRadius * 0.8 };
        } else if (!site && toGather.length === 0) {
          if (!exit) return true;
          if (left) return true;
          goal = { x: exit.x, z: exit.z, r: exit.r * 0.5 };
        } else {
          // Keep working the node we're at while it still gives what we need.
          const cur = loop.nodes.find((n) => loop.sensor.current?.id === `node:${n.id}`);
          const options = loop.nodes
            .filter((n) => n.canGather && toGather.includes(n.def.material))
            .sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z));
          // A relaxed player keeps heading for the node they chose, and sometimes chooses the second nearest.
          const kept: GatherNode | undefined = wanted ? options.find((n) => n.id === wanted) : undefined;
          const choice: GatherNode | undefined = kept ?? (relaxed && options.length > 1 && this.rng() < 0.35 ? options[1] : options[0]);
          wanted = choice?.id ?? null;
          const pick = cur && cur.canGather && toGather.includes(cur.def.material) ? cur : choice;
          goal = pick ? { x: pick.x, z: pick.z, r: pick.def.radius * 0.8 } : { x: w.x, z: w.z, r: 1 }; // wait for regrowth
        }
        const dx = goal.x - w.x, dz = goal.z - w.z, d = Math.hypot(dx, dz);
        let mx = 0, mz = 0;
        if (this.pause > 0) this.pause -= dt;
        else if (d > goal.r) {
          const stick = relaxed ? 0.75 : 1;
          mx = (dx / d) * stick; mz = (dz / d) * stick;
          if (sidestep > 0) { sidestep -= dt; const sx = -mz * sideSign, sz = mx * sideSign; mx = sx; mz = sz; }
        }
        const total = () => site ? MATERIALS.reduce((s, m) => s + state.deposits[site.id]![m], 0) : 0;
        const beforeTotal = total();
        loop.step(dt, { x: mx, z: mz });
        this.t += dt;

        const moved = Math.hypot(w.x - lastX, w.z - lastZ);
        lastX = w.x; lastZ = w.z;
        if (this.pause <= 0 && d > goal.r && moved < 0.3 * w.tuning.maxSpeed * dt * (relaxed ? 0.75 : 1)) {
          stuckFor += dt;
          if (stuckFor > 0.4) { sidestep = 0.7; sideSign = -sideSign; stuckFor = 0; }
        } else stuckFor = 0;

        // A trip ends when the bot has emptied what it can into the site.
        if (site && this.deliveredThisTrip > 0 && total() === beforeTotal && !loop.canDeposit(site)) {
          this.report.cycles.push(this.t - this.lastCycleEnd);
          this.lastCycleEnd = this.t;
          this.deliveredThisTrip = 0;
          wanted = null;
          if (relaxed) this.pause = 2.5; // a look at what just went up
        }
      }
      return false;
    } finally {
      this.report.timedOut ||= this.t >= maxT;
      loop.dispose();
    }
  }
}

export function runPacingBot(place: PlaceDef, ground: GroundQuery, opts: BotOptions = {}): PacingReport {
  const state = new GameState([place]);
  const bot = new Bot(state, opts);
  const ok = bot.play({ place, ground, start: place.spawn });
  // Done means every site that this place alone can open is complete.
  const loop = new CoreLoop(place, ground, state, place.spawn);
  bot.report.timedOut = !ok || loop.sites.some((s) => loop.siteOpen(s) && !loop.siteComplete(s));
  loop.dispose();
  return bot.report;
}

export interface JourneyReport extends PacingReport {
  /** Seconds at the end of each leg: home built, grove (shrine + bamboo for home), tea house. */
  legs: { home: number; grove: number; teaHouse: number };
}

/**
 * The Phase 4 gate as a bot: build the home valley, walk out through the trail gate, restore the wind
 * shrine and gather bamboo for home, walk back, build the tea house. Uses the real exits and arrivals.
 */
export function runJourneyBot(home: PlaceDef, grove: PlaceDef, grounds: Record<string, GroundQuery>, opts: BotOptions = {}): JourneyReport {
  const state = new GameState([home, grove]);
  const bot = new Bot(state, opts);
  const out = home.exits.find((e) => e.to === grove.id)!;
  const back = grove.exits.find((e) => e.to === home.id)!;
  const teaCost = BUILDINGS.tea_house.parts.filter((p) => p.material === 'bamboo').length;
  const legs = { home: 0, grove: 0, teaHouse: 0 };
  let ok = bot.play({ place: home, ground: grounds[home.id]!, start: home.spawn, leaveBy: out.id });
  legs.home = bot.t;
  if (ok) {
    state.discover(grove.id);
    ok = bot.play({ place: grove, ground: grounds[grove.id]!, start: grove.arrivals[out.arrive]!, carry: { bamboo: teaCost }, leaveBy: back.id });
    legs.grove = bot.t;
  }
  if (ok) {
    ok = bot.play({ place: home, ground: grounds[home.id]!, start: home.arrivals[back.arrive]! });
    legs.teaHouse = bot.t;
  }
  const r = bot.report;
  r.timedOut = !ok || !r.completedAt.tea_house;
  return { ...r, legs };
}
