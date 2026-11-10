// Builds a place: island terrain, pond, surrounding water, sky dome, lights, grass, and props.

import * as THREE from 'three';
import { fbm2, rng } from '../core/util';
import type { PlaceDef } from '../data/places';
import type { LightPreset } from '../data/presets';
import type { QualitySettings } from '../data/quality';
import type { Scattered } from '../sim/layout';
import { paintMaterial, windUniforms } from './materials';
import { bench, broadleafTree, cherryTree, pineTree, rock } from './models';

export interface Stage {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  heightAt(x: number, z: number): number;
  rebuildGrass(q: QualitySettings): void;
  update(time: number, focus: THREE.Vector3): void;
}

export function buildStage(place: PlaceDef, preset: LightPreset, scattered: readonly Scattered[], q: QualitySettings): Stage {
  const pal = place.palette;
  const group = new THREE.Group();
  group.name = `place:${place.id}`;
  const R = place.islandRadius;

  // Terrain height: gentle bumps, a bowl for the pond, and a soft drop at the rim into the water.
  const heightAt = (x: number, z: number): number => {
    const d = Math.hypot(x, z);
    let h = fbm2(x * 0.08, z * 0.08, 3, place.seed) * place.terrainRelief + 0.35;
    const pd = Math.hypot(x - place.pond.x, z - place.pond.z) / place.pond.r;
    if (pd < 1.4) h -= (1 - THREE.MathUtils.smoothstep(pd, 0.6, 1.4)) * 0.9;
    const rim = THREE.MathUtils.smoothstep(d, R - 2, R + 2);
    return h * (1 - rim) - rim * 1.4;
  };

  // --- terrain mesh with painted vertex colors
  // A polar grid: fine near the middle and even all the way to the rim.
  const rings = 48, segs = 96;
  const verts: number[] = [], cols: number[] = [], idx: number[] = [];
  const cMoss = new THREE.Color(pal.moss), cFern = new THREE.Color(pal.fern), cEarth = new THREE.Color(pal.lightWood), cSand = new THREE.Color(pal.paper);
  const tmp = new THREE.Color();
  for (let r = 0; r <= rings; r++) {
    const rad = ((R + 3) * r) / rings;
    const n = r === 0 ? 1 : segs;
    for (let s = 0; s < n; s++) {
      const a = (s / segs) * Math.PI * 2;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      verts.push(x, heightAt(x, z), z);
      const t = fbm2(x * 0.15, z * 0.15, 2, place.seed + 5) * 0.5 + 0.5;
      tmp.copy(cMoss).lerp(cFern, t);
      const path = Math.max(0, 1 - Math.abs(x) / 1.4) * THREE.MathUtils.smoothstep(z, -2, 2);
      tmp.lerp(cEarth, path * 0.7);
      tmp.lerp(cSand, THREE.MathUtils.smoothstep(rad, R - 1.5, R + 0.5));
      cols.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const ringStart = (r: number) => (r === 0 ? 0 : 1 + (r - 1) * segs);
  for (let s = 0; s < segs; s++) idx.push(0, ringStart(1) + ((s + 1) % segs), ringStart(1) + s);
  for (let r = 1; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = ringStart(r) + s, b = ringStart(r) + ((s + 1) % segs);
      const c = ringStart(r + 1) + s, d = ringStart(r + 1) + ((s + 1) % segs);
      idx.push(a, b, c, b, d, c);
    }
  }
  const ground = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  ground.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  ground.setIndex(idx);
  ground.computeVertexNormals();
  const terrain = new THREE.Mesh(ground, paintMaterial({ color: '#ffffff', vertexColors: true, brushRepeat: 8 }));
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  group.add(terrain);

  // --- water: the pond and the sea around the island
  const waterMat = (color: string, opacity: number) => new THREE.MeshToonMaterial({ color, transparent: true, opacity });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(place.pond.r + 0.6, 48), waterMat(pal.waterLight, 0.88));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(place.pond.x, -0.15, place.pond.z);
  pond.receiveShadow = true;
  pond.name = 'pond';
  group.add(pond);
  const rand = rng(place.seed + 99);
  const padMat = paintMaterial({ color: pal.fern });
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2, d = rand() * (place.pond.r - 1);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.35 + rand() * 0.2, 12, 0.3, Math.PI * 1.85), padMat);
    pad.rotation.set(-Math.PI / 2, 0, rand() * Math.PI * 2);
    pad.position.set(place.pond.x + Math.cos(a) * d, -0.12, place.pond.z + Math.sin(a) * d);
    group.add(pad);
  }
  const sea = new THREE.Mesh(new THREE.RingGeometry(R - 3, 200, 64), waterMat(pal.waterDeep, 1));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.6;
  sea.name = 'sea';
  group.add(sea);

  // --- sky dome with a vertical gradient (fog doesn't apply to it)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(preset.skyTop) }, horizon: { value: new THREE.Color(preset.skyHorizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float t = clamp(normalize(vP).y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, t), 1.0); \n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 12), skyMat);
  sky.name = 'sky';
  group.add(sky);

  // --- lights
  const hemi = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(preset.sunColor, preset.sunIntensity);
  const [sx, sy, sz] = preset.sunDirection;
  sun.position.set(sx, sy, sz).multiplyScalar(30);
  sun.castShadow = q.shadows;
  sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -18;
  sc.right = sc.top = 18;
  sc.near = 1;
  sc.far = 80;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  group.add(sun, sun.target);

  // --- scattered trees and rocks
  for (const s of scattered) {
    const m = s.kind === 'tree' ? broadleafTree(s.seed, pal.moss, pal.cedar)
      : s.kind === 'pine' ? pineTree(s.seed, '#5E7F62', pal.cedar)
      : rock(s.seed, pal.stone, pal.moss);
    m.position.set(s.x, heightAt(s.x, s.z) - 0.05, s.z);
    m.rotation.y = s.rot;
    m.scale.multiplyScalar(s.scale);
    group.add(m);
  }
  for (const p of place.props) {
    const m = p.kind === 'bench' ? bench(pal.lightWood, pal.stone)
      : p.kind === 'cherry' ? cherryTree(77, pal.cherry, pal.cedar)
      : p.kind === 'pine' ? pineTree(78, '#5E7F62', pal.cedar)
      : rock(79, pal.stone, pal.moss);
    m.position.set(p.x, heightAt(p.x, p.z), p.z);
    m.rotation.y = p.rot ?? 0;
    m.name = `prop:${p.id}`;
    group.add(m);
  }

  // --- grass: instanced blades, count from the quality tier
  let grass: THREE.InstancedMesh | null = null;
  const bladeGeo = new THREE.ConeGeometry(0.05, 0.38, 3);
  bladeGeo.translate(0, 0.19, 0);
  const grassMat = paintMaterial({ color: pal.fern, wind: 1.6 });
  const rebuildGrass = (qs: QualitySettings) => {
    if (grass) { group.remove(grass); grass.dispose(); }
    const count = qs.grassBlades;
    grass = new THREE.InstancedMesh(bladeGeo, grassMat, count);
    grass.name = 'grass';
    const gr = rng(place.seed + 3);
    const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), sc3 = new THREE.Vector3(), p3 = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 4) {
      tries++;
      const a = gr() * Math.PI * 2, d = Math.sqrt(gr()) * (R - 2);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.hypot(x - place.pond.x, z - place.pond.z) < place.pond.r + 0.8) continue;
      if (Math.abs(x) < 1.2 && z > -1) continue; // keep the path clear
      p3.set(x, heightAt(x, z), z);
      qn.setFromAxisAngle(up, gr() * Math.PI);
      const s = 0.6 + gr() * 0.8;
      sc3.set(s, s * (0.7 + gr() * 0.6), s);
      m.compose(p3, qn, sc3);
      grass.setMatrixAt(placed++, m);
    }
    grass.count = placed;
    grass.instanceMatrix.needsUpdate = true;
    grass.receiveShadow = true;
    group.add(grass);
  };
  rebuildGrass(q);

  const update = (time: number, focus: THREE.Vector3) => {
    windUniforms.uTime.value = time;
    // Keep the shadow frustum centred on the caretaker so shadows stay crisp near them.
    sun.target.position.copy(focus);
    sun.position.set(focus.x + sx * 30, focus.y + sy * 30, focus.z + sz * 30);
  };

  return { group, sun, heightAt, rebuildGrass, update };
}
