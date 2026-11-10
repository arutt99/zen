// Painterly materials: banded toon shading, a canvas brush texture, wind sway on foliage, and
// inverted-hull outline shells. Phase 2 retunes all of this toward the painted reference (plan 7.1).

import * as THREE from 'three';
import { rng } from '../core/util';

export interface StyleParams {
  /** Number of light bands in the toon ramp (Lanternfall-like: 3). */
  toneSteps: number;
  /** 0..1, how much the brush texture modulates color. */
  brushStrength: number;
  outlineColor: string;
  /** World-space outline thickness in metres. */
  outlineWidth: number;
}

export const DEFAULT_STYLE: StyleParams = { toneSteps: 3, brushStrength: 0.35, outlineColor: '#2E2620', outlineWidth: 0.035 };

let gradientCache: THREE.DataTexture | null = null;
let brushCache: THREE.CanvasTexture | null = null;

/** The toon ramp: `steps` hard bands from shadow to lit. */
export function toneRamp(steps: number): THREE.DataTexture {
  if (gradientCache && gradientCache.image.width === steps) return gradientCache;
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const v = Math.round(110 + (145 * i) / Math.max(1, steps - 1));
    data.set([v, v, v, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  gradientCache = tex;
  return tex;
}

/** A tiling canvas texture of soft dabs, so flat colors read as painted. */
export function brushTexture(strength: number): THREE.CanvasTexture {
  if (brushCache) return brushCache;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  const rand = rng(42);
  for (let i = 0; i < 900; i++) {
    const x = rand() * size, y = rand() * size;
    const r = 4 + rand() * 14;
    const shade = Math.round(255 - rand() * 255 * strength);
    g.fillStyle = `rgba(${shade},${shade},${shade},0.18)`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.35 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
    g.fill();
    // Wrap dabs across edges so the texture tiles without seams.
    for (const [ox, oy] of [[size, 0], [-size, 0], [0, size], [0, -size]] as const) {
      if (x + ox > -r && x + ox < size + r && y + oy > -r && y + oy < size + r) {
        g.beginPath();
        g.ellipse(x + ox, y + oy, r, r * 0.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  brushCache = tex;
  return tex;
}

/** Shared uniform so every swaying material reads one clock. */
export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };

export interface PaintOptions {
  color: THREE.ColorRepresentation;
  style?: StyleParams;
  /** Sway amplitude in metres at the top of the object (foliage). 0 = rigid. */
  wind?: number;
  vertexColors?: boolean;
  brushRepeat?: number;
}

export function paintMaterial(o: PaintOptions): THREE.MeshToonMaterial {
  const style = o.style ?? DEFAULT_STYLE;
  const mat = new THREE.MeshToonMaterial({
    color: o.color,
    gradientMap: toneRamp(style.toneSteps),
    map: brushTexture(style.brushStrength),
    vertexColors: o.vertexColors ?? false,
  });
  const repeat = o.brushRepeat ?? 1;
  mat.map!.repeat.set(repeat, repeat);
  if (o.wind && o.wind > 0) addWind(mat, o.wind);
  return mat;
}

/** Vertex sway that grows with height above the object's origin. */
function addWind(mat: THREE.Material, amount: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.uniforms.uSway = { value: amount };
    shader.vertexShader = 'uniform float uTime; uniform float uWind; uniform float uSway;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wp = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float h = max(transformed.y, 0.0);
      float ph = wp.x * 0.37 + wp.z * 0.21;
      transformed.x += sin(uTime * 1.3 + ph) * uSway * uWind * h * 0.15;
      transformed.z += cos(uTime * 1.1 + ph * 1.3) * uSway * uWind * h * 0.1;`,
    );
  };
  mat.customProgramCacheKey = () => `wind-${amount}`;
}

const outlineMats = new Map<string, THREE.MeshBasicMaterial>();

/** Inverted-hull outline: a back-face copy pushed out along normals. */
export function addOutline(mesh: THREE.Mesh, style: StyleParams = DEFAULT_STYLE, widthScale = 1): THREE.Mesh {
  const key = `${style.outlineColor}-${style.outlineWidth * widthScale}`;
  let mat = outlineMats.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color: style.outlineColor, side: THREE.BackSide });
    const w = style.outlineWidth * widthScale;
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n transformed += normalize(normal) * ${w.toFixed(4)};`,
      );
    };
    mat.customProgramCacheKey = () => `outline-${key}`;
    outlineMats.set(key, mat);
  }
  const shell = new THREE.Mesh(mesh.geometry, mat);
  shell.name = 'outline';
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return shell;
}
