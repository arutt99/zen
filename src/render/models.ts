// Procedural models built in code (plan 7.3): canopy blobs, trunks, pine tiers, rocks, a bench.
// Scale: 1 unit = 1 metre. Every builder is deterministic from its seed.

import * as THREE from 'three';
import { rng } from '../core/util';
import { addOutline, paintMaterial } from './materials';

const shadowed = <T extends THREE.Object3D>(o: T, cast = true): T => {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh && c.name !== 'outline') { c.castShadow = cast; c.receiveShadow = true; }
  });
  return o;
};

/** Squash and jitter a sphere's vertices so it reads as a soft hand-made blob. */
function blob(radius: number, detail: number, seed: number, jitter = 0.18): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const rand = rng(seed);
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let k = seen.get(key);
    if (k === undefined) { k = 1 + (rand() - 0.5) * jitter * 2; seen.set(key, k); }
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.85, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

export function broadleafTree(seed: number, leaf: string, trunk: string): THREE.Group {
  const rand = rng(seed);
  const g = new THREE.Group();
  const h = 1.8 + rand() * 0.8;
  const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, h, 7), paintMaterial({ color: trunk }));
  trunkMesh.position.y = h / 2;
  addOutline(trunkMesh);
  g.add(trunkMesh);
  const leafMat = paintMaterial({ color: leaf, wind: 0.6 });
  const blobs = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < blobs; i++) {
    const r = 0.8 + rand() * 0.6;
    const m = new THREE.Mesh(blob(r, 1, seed + i * 31), leafMat);
    const a = rand() * Math.PI * 2;
    const d = i === 0 ? 0 : 0.5 + rand() * 0.5;
    m.position.set(Math.cos(a) * d, h + 0.4 + rand() * 0.7, Math.sin(a) * d);
    addOutline(m);
    g.add(m);
  }
  return shadowed(g);
}

export function pineTree(seed: number, leaf: string, trunk: string): THREE.Group {
  const rand = rng(seed);
  const g = new THREE.Group();
  const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.2, 6), paintMaterial({ color: trunk }));
  trunkMesh.position.y = 0.6;
  g.add(trunkMesh);
  const mat = paintMaterial({ color: leaf, wind: 0.35 });
  const tiers = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < tiers; i++) {
    const r = 1.3 - i * 0.28;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.3, 8), mat);
    cone.position.y = 1.2 + i * 0.75;
    cone.rotation.y = rand() * Math.PI;
    addOutline(cone);
    g.add(cone);
  }
  return shadowed(g);
}

export function cherryTree(seed: number, blossom: string, trunk: string): THREE.Group {
  const t = broadleafTree(seed, blossom, trunk);
  t.scale.setScalar(1.15);
  return t;
}

export function rock(seed: number, stone: string, moss: string): THREE.Group {
  const rand = rng(seed);
  const g = new THREE.Group();
  const geo = blob(0.6, 0, seed, 0.3);
  geo.scale(1, 0.7, 1);
  const m = new THREE.Mesh(geo, paintMaterial({ color: stone }));
  m.position.y = 0.25;
  m.rotation.y = rand() * Math.PI;
  addOutline(m);
  g.add(m);
  if (rand() > 0.35) {
    const capGeo = blob(0.45, 0, seed + 7, 0.25);
    capGeo.scale(1, 0.35, 1);
    const cap = new THREE.Mesh(capGeo, paintMaterial({ color: moss }));
    cap.position.y = 0.55;
    g.add(cap);
  }
  return shadowed(g);
}

export function bench(wood: string, stone: string): THREE.Group {
  const g = new THREE.Group();
  const woodMat = paintMaterial({ color: wood });
  const stoneMat = paintMaterial({ color: stone });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.45), woodMat);
  seat.position.y = 0.45;
  addOutline(seat, undefined, 0.6);
  g.add(seat);
  for (const x of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.38), stoneMat);
    leg.position.set(x, 0.21, 0);
    addOutline(leg, undefined, 0.6);
    g.add(leg);
  }
  return shadowed(g);
}
