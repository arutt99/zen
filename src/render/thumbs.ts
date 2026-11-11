// Little pictures of decor models for the HUD (Phase 5): the decorating tray and the collection book show
// the real models, drawn once into a small render target with the game's own materials and ink, so the UI
// needs no words and no drawn icons. Cached per kind.
import * as THREE from 'three';
import { decorGeo } from './decor-models';
import { inked, Mats, shared } from './materials';

const cache = new Map<string, string>();
const SIZE = 128;

export function thumb(renderer: THREE.WebGLRenderer, kind: string): string {
  const hit = cache.get(kind);
  if (hit) return hit;
  const g = decorGeo(kind);
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry | undefined, mat: THREE.Material) => {
    if (!geo) return;
    group.add(inked(new THREE.Mesh(geo, mat), g.ink ?? 'nature'));
  };
  add(g.solid, Mats.std);
  add(g.leaf, Mats.stdFoliage);
  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xf2ecdc, 0x8a8068, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  // Frame the thing itself; a find's glint floats above it and would shrink the picture.
  const box = new THREE.Box3().setFromObject(group);
  if (g.glow) group.add(new THREE.Mesh(g.glow, Mats.glow));
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.62 + 0.05;
  const cam = new THREE.OrthographicCamera(-r, r, r, -r, 0.01, 100);
  cam.position.copy(centre).add(new THREE.Vector3(0.9, 0.75, 1.3).normalize().multiplyScalar(r * 6));
  cam.lookAt(centre);
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  // Draw in plain daylight whatever the time of day outside, and without the canopy fade.
  const keep = { light: shared.uLight.value, ink: shared.uInkRef.value, glow: shared.uGlow.value, focus: shared.uFocus.value.w };
  shared.uLight.value = 1; shared.uInkRef.value = 1.15; shared.uGlow.value = 1; shared.uFocus.value.w = 0;
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  shared.uLight.value = keep.light; shared.uInkRef.value = keep.ink; shared.uGlow.value = keep.glow; shared.uFocus.value.w = keep.focus;
  rt.dispose();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  // Render targets read bottom row first.
  for (let y = 0; y < SIZE; y++) img.data.set(px.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  cache.set(kind, url);
  return url;
}
