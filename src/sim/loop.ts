// The headless core loop (plan 9.3): the beat clock, gathering, depositing and node regrowth, driven
// by one move vector. Gather nodes and build sites are `Proximate`s picked by the one proximity rule.
// The browser game and the pacing bot both run exactly this.
import { BUILDINGS, type BuildingDef, type BuildingId } from '../data/buildings';
import { BEAT_SECONDS, FIRST_BEAT_SECONDS, type MaterialId } from '../data/gathering';
import type { ExitDef, PlaceDef } from '../data/places';
import type { MoveInput } from './input';
import { GatherNode } from './nodes';
import { completedAll, exitOpen, isComplete, nextDeposit, partsBuiltCount, siteOpen } from './progress';
import { PRIORITY, ProximitySensor, type Proximate } from './proximity';
import type { GameState } from './state';
import { Walker, type Blocker, type WalkArea } from './walker';

export type WorkKind = 'chop' | 'chip' | 'deposit';

export interface Site {
  readonly id: string;
  readonly def: BuildingDef;
  readonly x: number;
  readonly z: number;
  readonly rot: number;
}

/** Something that acts on the beat while it is the sensor's target. */
interface BeatTarget extends Proximate {
  readonly work: WorkKind;
  /** Seconds until the next beat lands. */
  timer: number;
}

export interface GroundQuery {
  walkable(x: number, z: number): boolean;
  /** Fixed blockers: trunks, rocks and props from the island generator. */
  solids: readonly Blocker[];
}

export class CoreLoop {
  readonly walker: Walker;
  readonly nodes: GatherNode[];
  readonly sites: Site[];
  readonly sensor = new ProximitySensor();
  /** Everything the sensor considers. Extra context targets (sit spots) can be pushed on. */
  readonly proximates: Proximate[] = [];
  /** What the caretaker is doing this frame, for animation. */
  work: { kind: WorkKind; target: Proximate; /** 0 → 1 toward the next beat landing. */ phase: number } | null = null;
  readonly area: WalkArea;
  /**
   * Called when the caretaker walks into an open exit (Phase 4). The game travels; with no handler (the
   * pacing bot, tests) nothing happens.
   */
  onLeave: ((exit: ExitDef) => void) | null = null;
  private blockers: Blocker[] = [];
  private blockersDirty = true;
  private unsubscribe: () => void;

  constructor(readonly place: PlaceDef, readonly ground: GroundQuery, readonly state: GameState, start: { x: number; z: number }) {
    this.walker = new Walker(start.x, start.z);
    this.nodes = place.nodes.map((n) => new GatherNode(n.id, n.kind, n.x, n.z));
    this.sites = place.sites.map((s) => ({ id: s.id, def: BUILDINGS[s.building], x: s.x, z: s.z, rot: s.rot ?? 0 }));
    for (const n of this.nodes) this.proximates.push(this.nodeTarget(n));
    for (const s of this.sites) this.proximates.push(this.siteTarget(s));
    for (const e of place.exits) this.proximates.push(this.exitTarget(e));
    this.unsubscribe = state.on((e) => { if (e.type === 'deposited' || e.type === 'completed') this.blockersDirty = true; });
    const self = this;
    this.area = {
      walkable: (x, z) => ground.walkable(x, z),
      get blockers() { return self.currentBlockers(); },
    };
  }

  /** The island's solids, plus trunks and boulders, plus any site that has started to go up. */
  private currentBlockers(): Blocker[] {
    if (!this.blockersDirty) return this.blockers;
    this.blockersDirty = false;
    this.blockers = [
      ...this.ground.solids,
      ...this.nodes.map((n) => ({ x: n.x, z: n.z, r: n.def.solidRadius })),
      ...this.sites.filter((s) => partsBuiltCount(s.def, this.state.deposits[s.id]!) > 0).map((s) => ({ x: s.x, z: s.z, r: s.def.solidRadius })),
      // A shut exit (the trail gate before the bell tower) blocks the way through.
      ...this.place.exits.filter((e) => !exitOpen(e, this.done())).flatMap((e) => e.closed ?? []),
    ];
    return this.blockers;
  }

  /** Every building complete, in any place (a site may wait on a building elsewhere). */
  done(): Set<BuildingId> {
    return completedAll(this.state.siteBuilding, this.state.deposits);
  }

  /** True when this exit can be walked. */
  exitOpen(e: ExitDef): boolean {
    return exitOpen(e, this.done());
  }

  /** Stops listening to the facts (when the game leaves this place). */
  dispose(): void {
    this.unsubscribe();
  }

  private exitTarget(e: ExitDef): Proximate {
    return {
      id: `exit:${e.id}`,
      priority: PRIORITY.exit,
      radius: e.r,
      x: e.x,
      z: e.z,
      kind: 'auto',
      isAvailable: () => exitOpen(e, this.done()),
      onEnter: () => this.onLeave?.(e),
      onTick: () => undefined,
      onExit: () => undefined,
    };
  }

  siteComplete(s: Site): boolean {
    return isComplete(s.def, this.state.deposits[s.id]!);
  }

  /** True once the site has revealed itself (its required buildings are complete). */
  siteOpen(s: Site): boolean {
    return siteOpen(s.def, this.done(), this.state.deposits[s.id]);
  }

  private nodeTarget(n: GatherNode): BeatTarget {
    const material: MaterialId = n.def.material;
    const t: BeatTarget = {
      id: `node:${n.id}`,
      priority: PRIORITY.gatherNode,
      radius: n.def.radius,
      x: n.x,
      z: n.z,
      kind: 'auto',
      work: material === 'stone' ? 'chip' : 'chop',
      timer: 0,
      isAvailable: () => n.canGather && this.state.room(material) > 0,
      onEnter: () => { t.timer = FIRST_BEAT_SECONDS; },
      onTick: (dt) => {
        t.timer -= dt;
        if (t.timer > 0) return;
        t.timer += BEAT_SECONDS;
        if (!n.canGather || this.state.room(material) <= 0) return;
        const unit = n.take();
        this.state.gather(n.id, material, unit, n.units);
      },
      onExit: () => undefined,
    };
    return t;
  }

  private siteTarget(s: Site): BeatTarget {
    const t: BeatTarget = {
      id: `site:${s.id}`,
      priority: PRIORITY.buildSite,
      radius: s.def.siteRadius,
      x: s.x,
      z: s.z,
      kind: 'auto',
      work: 'deposit',
      timer: 0,
      // Available until complete, even with an empty satchel, so standing on it shows the cost (plan 3.3).
      // Only once the site has revealed itself (plan 3.3).
      isAvailable: () => !this.siteComplete(s) && this.siteOpen(s),
      onEnter: () => { t.timer = FIRST_BEAT_SECONDS; },
      onTick: (dt) => {
        t.timer -= dt;
        if (t.timer > 0) return;
        t.timer += BEAT_SECONDS;
        const m = nextDeposit(s.def, this.state.deposits[s.id]!, this.state.satchel);
        if (m) this.state.deposit(s.id, m);
      },
      onExit: () => undefined,
    };
    return t;
  }

  /** True when the site target would deposit something on its next beat. */
  canDeposit(s: Site): boolean {
    return !this.siteComplete(s) && this.siteOpen(s) && nextDeposit(s.def, this.state.deposits[s.id]!, this.state.satchel) !== null;
  }

  /**
   * Advances everything by dt. With `canMove` false (sitting), the caretaker stays put and doesn't
   * work, but nodes keep regrowing.
   */
  step(dt: number, move: MoveInput, canMove = true): Proximate | null {
    if (!(dt > 0)) return this.sensor.current;
    for (const n of this.nodes) n.update(dt);
    if (!canMove) { this.work = null; return null; }
    const w = this.walker;
    w.step(dt, move, this.area);
    const target = this.sensor.update(w.x, w.z, this.proximates, dt);
    this.work = null;
    if (target && 'work' in target) {
      const bt = target as BeatTarget;
      const idle = bt.work === 'deposit' ? !this.canDeposit(this.sites.find((s) => `site:${s.id}` === bt.id)!) : false;
      if (!idle) this.work = { kind: bt.work, target, phase: 1 - Math.max(0, bt.timer) / BEAT_SECONDS };
      // Face the work when standing still (plan 3.1: "the caretaker turns to it").
      if (w.speed < 0.6 && bt.work !== 'deposit') w.heading = Math.atan2(target.x - w.x, target.z - w.z);
    }
    return target;
  }
}
