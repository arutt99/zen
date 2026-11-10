// Low mist over the unrestored valley (plan 3.4): soft, slow-drifting billboards near the ground.
// Its strength comes from the place's restoration level; when the shelter is done it lifts.
import * as THREE from 'three';
import { makeRng } from '../core/util';
import type { CircleArea } from '../data/places';
import { shared } from './materials';

const VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime, uScale, uLift;
  varying float vA;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.05 + aSeed.x * 6.28) * 1.6;
    p.z += cos(uTime * 0.04 + aSeed.y * 6.28) * 1.2;
    p.y += uLift * (1.5 + aSeed.z * 2.0);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vA = 0.55 + 0.45 * sin(uTime * 0.11 + aSeed.w * 6.28);
    gl_PointSize = min((5.0 + aSeed.w * 5.0) * uScale / -mv.z, 420.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(1.0 - d, 0.0), 2.2);
    gl_FragColor = vec4(uColor, a * vA * uAlpha * 0.32);
  }
`;

export class Mist {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;
  /** Shown strength, easing toward `target` over a few seconds. */
  amount: number;

  constructor(puffs: CircleArea[], heightAt: (x: number, z: number) => number, color: number, amount: number, seed: number) {
    const rng = makeRng(seed);
    const pos: number[] = [];
    const sd: number[] = [];
    for (const c of puffs) {
      const n = Math.max(4, Math.round(c.r * c.r * 0.16));
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * c.r;
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        pos.push(x, Math.max(heightAt(x, z), 0) + 0.4 + rng() * 0.8, z);
        sd.push(rng(), rng(), rng(), rng());
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 4));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTime: shared.uTime, uScale: { value: 400 }, uLift: { value: 0 },
        uColor: { value: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35) }, uAlpha: { value: amount },
      },
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    this.amount = amount;
  }

  update(dt: number, target: number, pixelScale: number): void {
    // Lifting takes several seconds, like mist burning off; it never snaps.
    const k = 1 - Math.exp(-dt * (target < this.amount ? 0.45 : 1.5));
    this.amount += (target - this.amount) * k;
    const u = this.mat.uniforms;
    u.uAlpha.value = this.amount;
    u.uLift.value = 1 - this.amount;
    u.uScale.value = pixelScale;
    this.points.visible = this.amount > 0.01;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}
