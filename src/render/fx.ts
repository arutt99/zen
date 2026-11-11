// Gathering and building feedback (plan 3.1, 3.3): falling leaves, wood chips, stone dust, items
// arcing from the basket to the site, and the completion burst. Every cue here pairs with a sound.
import * as THREE from 'three';
import { inked, Mats } from './materials';
import { MB } from './mb';
import { Particles } from './vfx';

const C = (hex: number) => new THREE.Color(hex);
const LEAF = [C(0x6f9a4a), C(0x9cbc5e), C(0xb7c977)];
const CHIP = [C(0xd9c39d), C(0xb89a6e)];
const DUST = [C(0xb0aa94), C(0xcfc8b4)];
const PETAL = [C(0xf3c2cf), C(0xe9a9b8), C(0xfff2e0)];
const BAMBOO_LEAF = [C(0x7aa048), C(0xa8c468), C(0xc8c47c)];
const STEAM = [C(0xfbf6ec), C(0xffffff)];
const SPLASH = [C(0xcfe6e0), C(0xffffff)];
type Material = 'wood' | 'stone' | 'bamboo';

interface Flight { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; spin: THREE.Vector3; onLand?: () => void }

export class Fx {
  readonly group = new THREE.Group();
  private parts: Particles;
  private flights: Flight[] = [];
  private pool: Record<Material, THREE.Mesh[]> = { wood: [], stone: [], bamboo: [] };
  private stickGeo = new MB().cyl(0.03, 0.04, 0.5, [0x6e4c32, 0xa48a62], {}, 5).build();
  private stoneGeo = new MB().ico(0.09, [0x7d7b6e, 0xb0aa94], { s: [1.2, 0.8, 1] }, 0).build();
  private bambooGeo = new MB().cyl(0.035, 0.04, 0.8, [0x7a9048, 0xb8c070], {}, 6).build();
  private rnd = Math.random;

  constructor(capacity: number) {
    this.parts = new Particles(capacity, false, 1.2);
    this.group.add(this.parts.mesh);
  }

  private burst(at: THREE.Vector3, n: number, colors: THREE.Color[], o: { speed: number; up: number; life: number; size: number; gravity: number; drag: number; spread?: number }) {
    const r = this.rnd;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, s = o.speed * (0.4 + r() * 0.8);
      const sp = o.spread ?? 0.4;
      this.parts.emit({
        x: at.x + (r() - 0.5) * sp, y: at.y + (r() - 0.5) * sp, z: at.z + (r() - 0.5) * sp,
        vx: Math.cos(a) * s, vy: o.up * (0.5 + r()), vz: Math.sin(a) * s,
        life: o.life * (0.7 + r() * 0.6), size: o.size * (0.7 + r() * 0.6), sizeEnd: o.size * 0.6,
        color: colors[Math.floor(r() * colors.length)]!, alpha: 0.95, gravity: o.gravity, drag: o.drag,
      });
    }
  }

  /** One chop: leaves drift down from the canopy, chips fly from the trunk. */
  chop(canopy: THREE.Vector3, trunk: THREE.Vector3, last: boolean) {
    this.burst(canopy, last ? 26 : 14, LEAF, { speed: 0.8, up: 0.4, life: 2.2, size: 0.2, gravity: 0.9, drag: 1.8, spread: 1.4 });
    this.burst(trunk, 7, CHIP, { speed: 1.8, up: 1.6, life: 0.7, size: 0.1, gravity: 7, drag: 0.6 });
  }

  /** One cut in a bamboo clump: long narrow leaves spin down from the top, a few pale shavings at the foot. */
  cut(top: THREE.Vector3, foot: THREE.Vector3, last: boolean) {
    this.burst(top, last ? 22 : 12, BAMBOO_LEAF, { speed: 0.7, up: 0.2, life: 2.8, size: 0.16, gravity: 0.6, drag: 2.0, spread: 1.2 });
    this.burst(foot, 6, CHIP, { speed: 1.4, up: 1.2, life: 0.6, size: 0.08, gravity: 7, drag: 0.6 });
  }

  /** A soft curl of steam (the tea set). */
  steam(at: THREE.Vector3) {
    this.burst(at, 1, STEAM, { speed: 0.04, up: 0.35, life: 2.6, size: 0.2, gravity: -0.05, drag: 0.8, spread: 0.08 });
  }

  /** The water pipe empties and knocks: a little splash where it pours. */
  splash(at: THREE.Vector3) {
    this.burst(at, 10, SPLASH, { speed: 0.6, up: 0.9, life: 0.7, size: 0.1, gravity: 4, drag: 1, spread: 0.2 });
  }

  /** One tap on a boulder: a puff of dust and a few flakes. */
  chip(at: THREE.Vector3) {
    this.burst(at, 10, DUST, { speed: 0.8, up: 0.5, life: 1.2, size: 0.32, gravity: 0.3, drag: 2.4, spread: 0.5 });
    this.burst(at, 6, DUST, { speed: 1.8, up: 1.8, life: 0.6, size: 0.09, gravity: 8, drag: 0.4 });
  }

  /** A part settles: a little dust where it lands. */
  settle(at: THREE.Vector3) {
    this.burst(at, 9, DUST, { speed: 1.1, up: 0.3, life: 0.9, size: 0.3, gravity: 0.4, drag: 2.6, spread: 1 });
  }

  /** A building is complete: petals and dust (plan 3.3). */
  complete(at: THREE.Vector3) {
    this.burst(at, 70, PETAL, { speed: 1.6, up: 2.2, life: 3.2, size: 0.18, gravity: 0.6, drag: 1.1, spread: 2.5 });
    this.burst(at, 24, DUST, { speed: 2.2, up: 0.4, life: 1.4, size: 0.45, gravity: 0.2, drag: 2.2, spread: 2 });
  }

  /** An item arcs from the basket to where its part goes. */
  fly(material: Material, from: THREE.Vector3, to: THREE.Vector3, dur: number, onLand?: () => void) {
    const pool = this.pool[material];
    let mesh = pool.pop();
    if (!mesh) {
      mesh = inked(new THREE.Mesh(material === 'wood' ? this.stickGeo : material === 'bamboo' ? this.bambooGeo : this.stoneGeo, Mats.std));
      this.group.add(mesh);
    }
    mesh.visible = true;
    mesh.position.copy(from);
    const spin = new THREE.Vector3(this.rnd() * 6 - 3, this.rnd() * 6 - 3, this.rnd() * 6 - 3);
    this.flights.push({ mesh, from: from.clone(), to: to.clone(), t: 0, dur, spin, onLand });
    (mesh.userData as { material: string }).material = material;
  }

  update(dt: number, now: number, pixelScale: number) {
    this.parts.update(now, pixelScale);
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i]!;
      f.t += dt / f.dur;
      const k = Math.min(1, f.t);
      const h = 1.4 + f.from.distanceTo(f.to) * 0.25;
      f.mesh.position.lerpVectors(f.from, f.to, k);
      f.mesh.position.y += Math.sin(k * Math.PI) * h;
      f.mesh.rotation.set(f.spin.x * k, f.spin.y * k, f.spin.z * k);
      if (k >= 1) {
        f.mesh.visible = false;
        this.pool[(f.mesh.userData as { material: Material }).material].push(f.mesh);
        this.flights.splice(i, 1);
        f.onLand?.();
      }
    }
  }

  dispose() {
    this.parts.dispose();
    this.stickGeo.dispose();
    this.stoneGeo.dispose();
    this.bambooGeo.dispose();
  }
}
