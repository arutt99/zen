// The restoration layer (plan 3.4): props that come and go as a place heals — overgrowth that shrinks
// away, flowers and lanterns that grow in, the trail gate that opens — plus poem stones and caretaker
// notes that appear with the buildings they belong to. Which items show is decided by the sim
// (src/sim/progress.ts growthShown / unlocked); this only draws them and eases each one in or out over a
// few seconds (pillar 6: nothing jumps from 0 to 100%). Instanced per kind, so it stays a handful of draws.
import * as THREE from 'three';
import { decorGeo } from './decor-models';
import { inked, Mats } from './materials';

export interface GrowthItem {
  id: string;
  kind: string;
  x: number;
  z: number;
  rot: number;
  scale: number;
}

interface Slot {
  item: GrowthItem;
  y: number;
  /** Shown amount, easing toward `target` (0..1). */
  shown: number;
  target: number;
  /** For lanterns: 0..1 how lit the paper is (the lantern ritual). */
  lit: number;
  litTarget: number;
}

interface KindMeshes {
  slots: Slot[];
  meshes: THREE.InstancedMesh[];
  glow?: THREE.InstancedMesh;
}

/** Seconds for a prop to grow in fully; overgrowth takes a little longer to wither away. */
const GROW_S = 2.6, FADE_S = 3.4;

export class GrowthLayer {
  readonly group = new THREE.Group();
  private kinds = new Map<string, KindMeshes>();
  private byId = new Map<string, Slot>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private dirty = true;

  constructor(items: readonly GrowthItem[], heightAt: (x: number, z: number) => number, shownAtStart: (id: string) => number) {
    for (const it of items) {
      let k = this.kinds.get(it.kind);
      if (!k) { k = { slots: [], meshes: [] }; this.kinds.set(it.kind, k); }
      const v = shownAtStart(it.id);
      const slot: Slot = { item: it, y: heightAt(it.x, it.z) - 0.05, shown: v, target: v, lit: 0, litTarget: 0 };
      k.slots.push(slot);
      this.byId.set(it.id, slot);
    }
    for (const [kind, k] of this.kinds) {
      const geo = decorGeo(kind);
      const solid = inked(new THREE.InstancedMesh(geo.solid, Mats.std, k.slots.length), geo.ink ?? 'nature');
      solid.castShadow = !geo.flat;
      solid.receiveShadow = true;
      k.meshes.push(solid);
      if (geo.leaf) {
        const leaf = inked(new THREE.InstancedMesh(geo.leaf, Mats.stdFoliage, k.slots.length), geo.ink ?? 'nature');
        leaf.castShadow = true;
        leaf.receiveShadow = true;
        k.meshes.push(leaf);
      }
      if (geo.glow) k.glow = new THREE.InstancedMesh(geo.glow, Mats.glow, k.slots.length);
      for (const mesh of [...k.meshes, ...(k.glow ? [k.glow] : [])]) {
        mesh.frustumCulled = false;
        this.group.add(mesh);
      }
    }
    this.writeMatrices();
  }

  /** Sets whether an item should be there (1) or not (0); it eases toward it. */
  setTarget(id: string, v: number): void {
    const s = this.byId.get(id);
    if (s && s.target !== v) { s.target = v; this.dirty = true; }
  }

  /** Lights (1) or dims (0) a lantern's paper; `delay` seconds lets a row of lanterns light one by one. */
  setLit(id: string, v: number): void {
    const s = this.byId.get(id);
    if (s && s.litTarget !== v) { s.litTarget = v; this.dirty = true; }
  }

  /** Screenshots and tests: jump every item to where it is heading. */
  snap(): void {
    for (const k of this.kinds.values()) for (const s of k.slots) { s.shown = s.target; s.lit = s.litTarget; }
    this.writeMatrices();
  }

  shown(id: string): number {
    return this.byId.get(id)?.shown ?? 0;
  }

  lit(id: string): number {
    return this.byId.get(id)?.lit ?? 0;
  }

  /** Items of a kind that are mostly there, with their positions (for lantern light, sit spots…). */
  slotsOf(kind: string): { id: string; x: number; y: number; z: number; shown: number; lit: number }[] {
    return (this.kinds.get(kind)?.slots ?? []).map((s) => ({ id: s.item.id, x: s.item.x, y: s.y, z: s.item.z, shown: s.shown, lit: s.lit }));
  }

  update(dt: number): void {
    if (!(dt > 0)) return;
    let moving = this.dirty;
    for (const k of this.kinds.values()) {
      for (const s of k.slots) {
        if (s.shown !== s.target) {
          const step = dt / (s.target > s.shown ? GROW_S : FADE_S);
          s.shown = s.target > s.shown ? Math.min(s.target, s.shown + step) : Math.max(s.target, s.shown - step);
          moving = true;
        }
        if (s.lit !== s.litTarget) {
          s.lit = s.litTarget > s.lit ? Math.min(s.litTarget, s.lit + dt / 0.8) : Math.max(s.litTarget, s.lit - dt / 2);
          moving = true;
        }
      }
    }
    if (moving) this.writeMatrices();
    this.dirty = false;
  }

  private writeMatrices(): void {
    for (const k of this.kinds.values()) {
      k.slots.forEach((s, i) => {
        // Grow from the ground with a soft overshoot; shrink back down into it.
        const t = s.shown;
        const e = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.08;
        const sc = s.item.scale * e;
        this.q.setFromAxisAngle(this.up, s.item.rot + (1 - t) * 0.4);
        this.p.set(s.item.x, s.y - (1 - e) * 0.15, s.item.z);
        this.s.set(sc || 1e-4, sc || 1e-4, sc || 1e-4);
        this.m.compose(this.p, this.q, this.s);
        for (const mesh of k.meshes) mesh.setMatrixAt(i, this.m);
        if (k.glow) {
          const g = s.item.kind === 'path_lantern' ? s.lit : 1;
          const gs = (sc || 1e-4) * (g > 0.01 ? 1 : 1e-4);
          this.s.set(gs, gs, gs);
          k.glow.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
        }
      });
      for (const mesh of k.meshes) mesh.instanceMatrix.needsUpdate = true;
      if (k.glow) k.glow.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const k of this.kinds.values()) {
      for (const mesh of k.meshes) mesh.dispose();
      k.glow?.dispose();
    }
  }
}
