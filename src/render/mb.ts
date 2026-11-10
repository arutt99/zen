// Copied from Lanternfall (games/lanternfall/src/render/mb.ts @ b282628). Outline data is added when the look draws outlines.
// Model builder: composes primitives with vertex colors into one merged geometry.
import * as THREE from 'three';
import { anyOutline } from './look';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm } from '../core/util';

export type Col = number | [number, number];

export interface PartOpts {
  p?: [number, number, number];
  r?: [number, number, number];
  s?: number | [number, number, number];
  /** Faceted shading instead of smooth. */
  flat?: boolean;
  /** Displacement amplitude for a hand-carved, uneven look. */
  wobble?: number;
  wobbleFreq?: number;
  /** Multiplier applied to color (values above 1 glow when used with the glow material). */
  gain?: number;
  /** Blends normals toward spherical, which makes foliage read as soft puffs. */
  puff?: number;
}

const tmpColor = new THREE.Color();
const tmpColor2 = new THREE.Color();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();

let wobbleSeed = 1;

/** Averaged normals at shared positions keep the outline shell closed across hard edges, plus a second draw of the same triangles for it. */
function addInkData(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const sums = new Map<string, [number, number, number]>();
  const keyAt = (i: number) => `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = keyAt(i);
    let v = sums.get(k);
    if (!v) sums.set(k, v = [0, 0, 0]);
    v[0] += nrm.getX(i); v[1] += nrm.getY(i); v[2] += nrm.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = sums.get(keyAt(i))!;
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    out[i * 3] = v[0] / l; out[i * 3 + 1] = v[1] / l; out[i * 3 + 2] = v[2] / l;
  }
  g.setAttribute('aInk', new THREE.BufferAttribute(out, 3));
  g.addGroup(0, pos.count, 0);
  g.addGroup(0, pos.count, 1);
}

export class MB {
  private parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, col: Col, o: PartOpts = {}) {
    let g = geo;
    const wobble = o.wobble ?? 0;
    if (wobble > 0) {
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const f = o.wobbleFreq ?? 1.4;
      const seed = wobbleSeed++ * 13;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const nx = fbm(x * f + y * 0.7, z * f, seed, 2) - 0.5;
        const ny = fbm(y * f + x * 0.3, z * f + 3, seed + 1, 2) - 0.5;
        const nz = fbm(z * f + y * 0.5, x * f + 7, seed + 2, 2) - 0.5;
        pos.setXYZ(i, x + nx * wobble * 2, y + ny * wobble * 2, z + nz * wobble * 2);
      }
      g.computeVertexNormals();
    }
    if (g.index) {
      const ng = g.toNonIndexed();
      g.dispose();
      g = ng;
    }
    if (o.flat) g.computeVertexNormals();
    g.deleteAttribute('uv');
    g.deleteAttribute('uv1');

    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c0 = Array.isArray(col) ? col[0] : col;
    const c1 = Array.isArray(col) ? col[1] : col;
    tmpColor.set(c0);
    tmpColor2.set(c1);
    const gain = o.gain ?? 1;
    const dy = bb.max.y - bb.min.y || 1;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - bb.min.y) / dy;
      colors[i * 3] = (tmpColor.r + (tmpColor2.r - tmpColor.r) * t) * gain;
      colors[i * 3 + 1] = (tmpColor.g + (tmpColor2.g - tmpColor.g) * t) * gain;
      colors[i * 3 + 2] = (tmpColor.b + (tmpColor2.b - tmpColor.b) * t) * gain;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    if (o.puff) {
      const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
      const cx = (bb.max.x + bb.min.x) / 2, cy = (bb.max.y + bb.min.y) / 2, cz = (bb.max.z + bb.min.z) / 2;
      for (let i = 0; i < pos.count; i++) {
        tmpV.set(pos.getX(i) - cx, pos.getY(i) - cy, pos.getZ(i) - cz).normalize();
        tmpS.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).lerp(tmpV, o.puff).normalize();
        nrm.setXYZ(i, tmpS.x, tmpS.y, tmpS.z);
      }
    }

    const p = o.p ?? [0, 0, 0];
    const r = o.r ?? [0, 0, 0];
    const s = o.s ?? 1;
    tmpE.set(r[0], r[1], r[2]);
    tmpQ.setFromEuler(tmpE);
    tmpV.set(p[0], p[1], p[2]);
    if (typeof s === 'number') tmpS.set(s, s, s);
    else tmpS.set(s[0], s[1], s[2]);
    tmpM.compose(tmpV, tmpQ, tmpS);
    g.applyMatrix4(tmpM);
    this.parts.push(g);
    return this;
  }

  cyl(rt: number, rb: number, h: number, col: Col, o: PartOpts = {}, seg = 12, hseg = 1) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, hseg), col, o);
  }
  cone(r: number, h: number, col: Col, o: PartOpts = {}, seg = 12, hseg = 1) {
    return this.add(new THREE.ConeGeometry(r, h, seg, hseg), col, o);
  }
  sphere(r: number, col: Col, o: PartOpts = {}, ws = 14, hs = 10) {
    return this.add(new THREE.SphereGeometry(r, ws, hs), col, o);
  }
  ico(r: number, col: Col, o: PartOpts = {}, detail = 1) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), col, { flat: true, ...o });
  }
  box(w: number, h: number, d: number, col: Col, o: PartOpts = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d), col, o);
  }
  torus(r: number, tube: number, col: Col, o: PartOpts = {}, rs = 8, ts = 24) {
    return this.add(new THREE.TorusGeometry(r, tube, rs, ts), col, o);
  }
  /** Elongated octahedron with flat facets. */
  crystal(r: number, h: number, col: Col, o: PartOpts = {}) {
    const g = new THREE.OctahedronGeometry(r, 0);
    g.scale(1, h / r / 2 * 1, 1);
    return this.add(g, col, { flat: true, ...o });
  }
  lathe(profile: [number, number][], col: Col, o: PartOpts = {}, seg = 16) {
    const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
    return this.add(new THREE.LatheGeometry(pts, seg), col, o);
  }

  get empty() {
    return this.parts.length === 0;
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    if (anyOutline()) addInkData(merged);
    return merged;
  }
}
