// Soft contact shadows (Painted+ look, owner request 2026-11-10). The warm, soft darkening on the
// ground right under things is what keeps a prop from looking pasted on.
// - Static things (decor, gather nodes) and build sites are painted once into a small ground texture
//   that the terrain shader reads (`contactField`): no extra draw calls, and it follows the terrain.
//   Red = props and nodes; green = build sites, scaled live by how much of the building stands.
// - Moving figures (caretaker, deer) carry a soft blob under their feet (`contactBlob`).
import * as THREE from 'three';
import { look } from './look';

/** An oriented soft footprint on the ground: centre, half extents along its own x and z, turn, strength. */
export interface Footprint { x: number; z: number; hx: number; hz: number; rot: number; k: number; site?: boolean }

/** Texels per metre of the contact field. */
export const CONTACT_RES = 4;

/**
 * Paints footprints into an RGBA byte field covering [-extW, extW] x [-extH, extH].
 * Each footprint is a soft ellipse (Gaussian falloff past its edge); overlapping ones combine like
 * layers of thin paint (1 - (1-a)(1-b)), so a cluster never goes black.
 */
export function contactField(extW: number, extH: number, prints: Footprint[]): { data: Uint8Array; w: number; h: number } {
  const w = Math.ceil(extW * 2 * CONTACT_RES) + 1;
  const h = Math.ceil(extH * 2 * CONTACT_RES) + 1;
  const r = new Float32Array(w * h);
  const g = new Float32Array(w * h);
  for (const p of prints) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const reach = Math.max(p.hx, p.hz) * 2.2 + 1.0;
    const i0 = Math.max(0, Math.floor((p.x - reach + extW) * CONTACT_RES));
    const i1 = Math.min(w - 1, Math.ceil((p.x + reach + extW) * CONTACT_RES));
    const j0 = Math.max(0, Math.floor((p.z - reach + extH) * CONTACT_RES));
    const j1 = Math.min(h - 1, Math.ceil((p.z + reach + extH) * CONTACT_RES));
    const out = p.site ? g : r;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i / CONTACT_RES - extW - p.x, dz = j / CONTACT_RES - extH - p.z;
        // Into the footprint's own frame (three.js turns +x toward -z for a positive y rotation).
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        // Full strength under the object, fading out over ~half a metre past its edge.
        const e = Math.hypot(lx / (p.hx + 0.3), lz / (p.hz + 0.3));
        const a = p.k * Math.exp(-Math.pow(Math.max(0, e - 0.55), 2) * 2.6);
        const idx = j * w + i;
        out[idx] = 1 - (1 - out[idx]!) * (1 - a);
      }
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = Math.round(Math.min(1, r[i]!) * 255);
    data[i * 4 + 1] = Math.round(Math.min(1, g[i]!) * 255);
    data[i * 4 + 3] = 255;
  }
  return { data, w, h };
}

/** The footprint of a model from its bounding box, at a scale and turn. */
export function footprintOf(geo: THREE.BufferGeometry, x: number, z: number, rot: number, scale: number, k: number): Footprint {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  // Off-centre models (a branch reaching out) still shade around their middle.
  const cx = (b.min.x + b.max.x) / 2 * scale, cz = (b.min.z + b.max.z) / 2 * scale;
  const c = Math.cos(rot), s = Math.sin(rot);
  return {
    x: x + cx * c + cz * s, z: z - cx * s + cz * c,
    hx: (b.max.x - b.min.x) / 2 * scale, hz: (b.max.z - b.min.z) / 2 * scale, rot, k,
  };
}

const BLOB_FRAG = /* glsl */ `
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.15, 1.0, r);
    gl_FragColor = vec4(0.14, 0.09, 0.06, pow(a, 1.3) * uAlpha);
  }
`;

/** A soft warm blob under a moving figure, or null when the look has no contact shadows. */
export function contactBlob(radius: number): THREE.Mesh | null {
  const k = look().light.contact;
  if (k <= 0) return null;
  const geo = new THREE.CircleGeometry(radius, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: BLOB_FRAG,
    uniforms: { uAlpha: { value: 0.85 * k } },
  });
  const m = new THREE.Mesh(geo, mat);
  // Lifted a little: the terrain mesh is a grid (1 m on Low) and can sit above the exact ground height.
  m.position.y = 0.12;
  m.renderOrder = 2;
  m.name = 'contact';
  return m;
}
