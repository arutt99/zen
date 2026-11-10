// Copied from Lanternfall (games/lanternfall/src/render/materials.ts @ b282628). Unchanged.
// The painterly material system: brush-stroke albedo variation, soft rim light, and wind.
import * as THREE from 'three';
import { INK } from './style';
import { makeRng } from '../core/util';

export const shared = {
  uTime: { value: 0 },
  uBrush: { value: null as THREE.Texture | null },
  uRim: { value: new THREE.Color(0.4, 0.34, 0.3) },
  /** Scales lighting so the painted tone bands fall in the same place under any biome's sun. */
  uInkRef: { value: 1 },
};

export function makeBrushTexture(): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const rng = makeRng(4242);
  const strokes = 3400;
  for (let i = 0; i < strokes; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const big = i < strokes * 0.3;
    const len = (big ? 34 : 12) + rng() * (big ? 50 : 22);
    const wid = (big ? 8 : 2.5) + rng() * (big ? 14 : 5);
    const ang = -0.6 + (rng() - 0.5) * 1.2;
    const v = Math.floor(128 + (rng() - 0.5) * (big ? 110 : 160));
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.14 + rng() * 0.24})`;
    ctx.lineWidth = wid;
    ctx.lineCap = 'round';
    // Draw wrapped copies so the texture tiles without seams.
    for (let ox = -size; ox <= size; ox += size) {
      for (let oy = -size; oy <= size; oy += size) {
        if (x + ox < -100 || x + ox > size + 100 || y + oy < -100 || y + oy > size + 100) continue;
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(
          x + ox + Math.cos(ang) * len * 0.5 + (rng() - 0.5) * 10,
          y + oy + Math.sin(ang) * len * 0.5 + (rng() - 0.5) * 10,
          x + ox + Math.cos(ang) * len,
          y + oy + Math.sin(ang) * len,
        );
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

export interface PaintOpts {
  wind?: number;
  rim?: number;
  brush?: number;
}

const PAINT_VERT_HEAD = /* glsl */ `
  varying vec3 vPWorld;
  uniform float uTime;
  uniform float uWind;
`;
const PAINT_FRAG_HEAD = /* glsl */ `
  varying vec3 vPWorld;
  uniform sampler2D uBrush;
  uniform vec3 uRim;
  uniform float uRimAmt;
  uniform float uBrushAmt;
`;

/** Replaces smooth shading with three painted tones. Keeps the light's color, so each biome keeps its mood. */
export function celPatch(frag: string) {
  if (!INK) return frag;
  const line = 'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;';
  return 'uniform float uInkRef;\n' + frag.replace(line, /* glsl */ `${line}
    {
      vec3 inkAlb = max(material.diffuseColor, vec3(0.002));
      vec3 inkIll = totalDiffuse / inkAlb;
      float inkL = dot(inkIll, vec3(0.2126, 0.7152, 0.0722)) * uInkRef;
      float inkBand = 0.6 + 0.3 * smoothstep(0.62, 0.68, inkL) + 0.32 * smoothstep(1.02, 1.08, inkL);
      vec3 inkShade = mix(vec3(0.8, 0.82, 1.08), vec3(1.0), smoothstep(0.62, 0.72, inkL));
      vec3 inkHue = mix(vec3(1.0), inkIll * uInkRef / max(inkL, 0.001), 0.55);
      totalDiffuse = inkAlb * inkHue * inkShade * inkBand;
    }`);
}

/** Shared by the outline shell. Line width is a fraction of the window height, so it looks the same at any resolution. */
export const inkShared = {
  uAspect: { value: 1 },
  uWidth: { value: 1.9 / 720 },
};

function outlineMaterial(wind: number) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexColors: true,
    uniforms: { uTime: shared.uTime, uWind: { value: wind }, uAspect: inkShared.uAspect, uWidth: inkShared.uWidth },
    vertexShader: /* glsl */ `
      attribute vec3 aInk;
      uniform float uTime, uWind, uAspect, uWidth;
      varying vec3 vInkCol;
      void main() {
        vec3 t = position;
        #ifdef USE_INSTANCING
          mat4 im = instanceMatrix;
        #else
          mat4 im = mat4(1.0);
        #endif
        if (uWind > 0.0) {
          vec3 wb = (modelMatrix * im[3]).xyz;
          float wh = max(position.y, 0.0);
          float sway = sin(uTime * 1.25 + wb.x * 0.37 + wb.z * 0.29) + 0.5 * sin(uTime * 2.8 + wb.x * 0.9 + position.y);
          t.x += sway * uWind * wh * wh;
          t.z += cos(uTime * 1.05 + wb.z * 0.41) * uWind * 0.6 * wh * wh;
        }
        vec4 mv = modelViewMatrix * im * vec4(t, 1.0);
        vec4 clip = projectionMatrix * mv;
        vec3 nv = mat3(modelViewMatrix) * mat3(im) * aInk;
        vec2 d = vec2(nv.x * uAspect, nv.y);
        float dl = length(d);
        if (dl > 0.0001) {
          d /= dl;
          // Slightly heavier lines up close, finer ones from far away.
          float near = clamp(sqrt(90.0 / clip.w), 0.8, 1.7);
          clip.xy += vec2(d.x / uAspect, d.y) * uWidth * 2.0 * near * clip.w;
        }
        gl_Position = clip;
        vInkCol = color;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vInkCol;
      void main() { gl_FragColor = vec4(mix(vec3(0.035, 0.022, 0.04), vInkCol * 0.1, 0.45), 1.0); }
    `,
  });
}

/** Adds the ink outline to a mesh built by MB. Instanced meshes need nothing extra. */
export function inked<T extends THREE.Mesh>(mesh: T): T {
  if (!INK || !mesh.geometry.getAttribute('aInk')) return mesh;
  const base = mesh.material as THREE.Material;
  mesh.material = [base, base === Mats.stdFoliage ? Mats.outlineFoliage : Mats.outline];
  return mesh;
}

/** Patches a standard/lambert material with the game's painterly look. */
export function paint<T extends THREE.Material>(mat: T, opts: PaintOpts = {}): T {
  const wind = opts.wind ?? 0;
  const rim = (opts.rim ?? 1) * (INK ? 0.4 : 1);
  const brush = (opts.brush ?? 1) * (INK ? 0.42 : 1);
  const hasNormal = !(mat instanceof THREE.MeshLambertMaterial);
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uBrush = shared.uBrush;
    s.uniforms.uRim = shared.uRim;
    s.uniforms.uInkRef = shared.uInkRef;
    s.uniforms.uWind = { value: wind };
    s.uniforms.uRimAmt = { value: rim };
    s.uniforms.uBrushAmt = { value: brush };
    s.vertexShader = PAINT_VERT_HEAD + s.vertexShader
      .replace('#include <begin_vertex>', /* glsl */ `
        #include <begin_vertex>
        ${wind > 0 ? /* glsl */ `
        #ifdef USE_INSTANCING
          vec3 windBase = instanceMatrix[3].xyz;
        #else
          vec3 windBase = modelMatrix[3].xyz;
        #endif
        float windH = max(position.y, 0.0);
        float sway = sin(uTime * 1.25 + windBase.x * 0.37 + windBase.z * 0.29) + 0.5 * sin(uTime * 2.8 + windBase.x * 0.9 + position.y);
        transformed.x += sway * uWind * windH * windH;
        transformed.z += cos(uTime * 1.05 + windBase.z * 0.41) * uWind * 0.6 * windH * windH;
        ` : ''}
      `)
      .replace('#include <project_vertex>', /* glsl */ `
        #include <project_vertex>
        vec4 pWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          pWorld = instanceMatrix * pWorld;
        #endif
        vPWorld = (modelMatrix * pWorld).xyz;
      `);
    s.fragmentShader = PAINT_FRAG_HEAD + celPatch(s.fragmentShader)
      .replace('#include <color_fragment>', /* glsl */ `
        #include <color_fragment>
        {
          vec2 bp = vPWorld.xz * 0.42 + vPWorld.y * vec2(0.23, 0.41);
          float b = texture2D(uBrush, bp).r;
          float b2 = texture2D(uBrush, bp * 0.31 + 0.27).r;
          float bm = (b * 0.6 + b2 * 0.4) - 0.5;
          diffuseColor.rgb *= 1.0 + bm * 0.62 * uBrushAmt;
          diffuseColor.rgb += bm * vec3(0.05, 0.015, -0.045) * uBrushAmt;
        }
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */ `
        #include <emissivemap_fragment>
        ${hasNormal ? /* glsl */ `
        {
          float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.2);
          totalEmissiveRadiance += uRim * rimF * uRimAmt * diffuseColor.rgb * 1.6;
        }
        ` : ''}
      `);
  };
  mat.customProgramCacheKey = () => `paint-${wind}-${rim}-${brush}-${mat.type}`;
  return mat;
}

/** Shared materials so that everything batches onto the same programs. */
export const Mats = {
  std: null as unknown as THREE.MeshStandardMaterial,
  stdFoliage: null as unknown as THREE.MeshStandardMaterial,
  glow: null as unknown as THREE.MeshBasicMaterial,
  metal: null as unknown as THREE.MeshStandardMaterial,
  outline: null as unknown as THREE.ShaderMaterial,
  outlineFoliage: null as unknown as THREE.ShaderMaterial,
};

export function initMaterials() {
  shared.uBrush.value = makeBrushTexture();
  Mats.std = paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 }));
  Mats.stdFoliage = paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), { wind: 0.0042, rim: 1.3 });
  Mats.metal = paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.72 }), { brush: 0.5 });
  Mats.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
  if (INK) {
    // Caps brightness while keeping the hue, so magic reads as a saturated color instead of blowing out to white.
    Mats.glow.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
        #include <opaque_fragment>
        gl_FragColor.rgb *= min(1.0, 1.35 / max(max(gl_FragColor.r, gl_FragColor.g), max(gl_FragColor.b, 0.001)));
      `);
    };
  }
  Mats.outline = outlineMaterial(0);
  Mats.outlineFoliage = outlineMaterial(0.0042);
}
