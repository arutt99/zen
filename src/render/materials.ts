// Copied from Lanternfall (games/lanternfall/src/render/materials.ts @ b282628).
// Phase 2: driven by the active look preset (src/data/looks.ts) instead of the ink/classic switch:
// tone steps, shadow tint, brush, rim, a global color remap, outline color/width and which objects get
// outlines. Adds a time-of-day light level, lantern glow strength and the canopy fade between the camera
// and the caretaker.
// The painterly material system: brush-stroke albedo variation, soft rim light, and wind.
import * as THREE from 'three';
import type { OutlineClass } from '../data/looks';
import { f, look, outlined, rich, v3 } from './look';
import { makeRng } from '../core/util';

export const shared = {
  uTime: { value: 0 },
  uBrush: { value: null as THREE.Texture | null },
  uRim: { value: new THREE.Color(0.4, 0.34, 0.3) },
  /** Scales lighting so the painted tone bands fall in the same place under any light. */
  uInkRef: { value: 1 },
  /** Overall brightness of the time of day relative to full day (night is dimmer, never black). */
  uLight: { value: 1 },
  /** Lantern glow strength: low by day, full at night. */
  uGlow: { value: 1 },
  /** The caretaker's chest, world space; canopies between it and the camera thin out. w = on (1) / off (0). */
  uFocus: { value: new THREE.Vector4(0, 0, 0, 0) },
  /** Lanternfall+: up to LAMPS lanterns that light the ground and things near them at night (xyz, w = strength). */
  uLamps: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)) },
};

/** How many lantern lights the shaders read (Lanternfall+). */
export const LAMPS = 8;

/**
 * Warm light from lanterns at dusk and night (Lanternfall+): two crisp rings, like Lanternfall's bands,
 * fading in as the lanterns' glow rises. Adds to `totalEmissiveRadiance`, scaled by `albedo`.
 */
export const LAMP_GLSL = /* glsl */ `
  uniform vec4 uLamps[${LAMPS}];
  uniform float uGlow;
  vec3 lampLight(vec3 p, vec3 albedo) {
    float k = smoothstep(0.6, 1.4, uGlow);
    if (k <= 0.0) return vec3(0.0);
    float sum = 0.0;
    for (int i = 0; i < ${LAMPS}; i++) {
      vec4 L = uLamps[i];
      if (L.w <= 0.0) continue;
      float d = distance(p, L.xyz);
      float R = 4.2;
      sum += L.w * (smoothstep(R, R * 0.86, d) * 0.5 + smoothstep(R * 0.5, R * 0.42, d) * 0.5);
    }
    return albedo * vec3(1.0, 0.6, 0.28) * sum * k * 0.85;
  }
`;

/**
 * Inked surface marks (Lanternfall+): wood grain along a part's long axis, coarser grain on bark, and a
 * few cracks on stone, drawn as fine dark lines that fade out where they would get too dense to read.
 */
const MARK_GLSL = /* glsl */ `
  varying vec4 vMark;
  varying vec3 vLocal;
  vec3 markHash(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453);
  }
  // A thin line at every whole number of v, about \`width\` pixels wide; fades out where lines crowd.
  float markLine(float v, float width) {
    float fw = fwidth(v);
    float d = abs(fract(v + 0.5) - 0.5);
    float line = 1.0 - smoothstep(fw * width * 0.5, fw * width * 1.1, d);
    return line * (1.0 - smoothstep(0.12, 0.3, fw));
  }
  float inkMarks() {
    float kind = vMark.w;
    if (kind < 1.5) return 0.0;
    vec3 a = normalize(vMark.xyz + vec3(1e-4));
    vec3 b = normalize(cross(a, abs(a.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 c = cross(a, b);
    vec3 p = vLocal;
    if (kind < 3.5) {
      // Grain: lines along the long axis, gently warped by the brush noise.
      float s = dot(p, a), u = dot(p, b) + dot(p, c) * 0.83;
      float bark = step(2.5, kind);
      float n = texture2D(uBrush, vec2(s * 0.22, u * 0.35)).r;
      float freq = mix(14.0, 7.0, bark);
      float v = u * freq + (n - 0.5) * mix(2.4, 3.2, bark);
      float line = markLine(v, mix(1.2, 1.8, bark));
      // Grain comes and goes a little, so it reads as wood rather than stripes.
      line *= smoothstep(0.3, 0.55, texture2D(uBrush, vec2(s * 0.5 + 0.3, u * 1.3)).r);
      return line * mix(0.5, 0.65, bark);
    }
    // Stone: the edges of a 3D cell pattern, shown only in patches, read as cracks.
    vec3 q = p * 3.2;
    vec3 i = floor(q), fq = fract(q);
    float d1 = 8.0, d2 = 8.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 r = g + markHash(i + g) - fq;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    float e = sqrt(d2) - sqrt(d1);
    float w = fwidth(e) * 1.3;
    float crack = (1.0 - smoothstep(w * 0.5, w * 1.5, e)) * (1.0 - smoothstep(0.25, 0.6, fwidth(q.x) + fwidth(q.y)));
    crack *= smoothstep(0.5, 0.62, texture2D(uBrush, p.xz * 0.45 + p.y * 0.3).r);
    return crack * 0.6;
  }
`;

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
  /** Thin out where it stands between the camera and the caretaker (foliage). */
  fade?: boolean;
  /** Draw inked wood grain and stone cracks from the geometry's `aMark` (Lanternfall+ only). */
  marks?: boolean;
}

/** The canopy fade: dithered see-through where the fragment sits near the camera→caretaker line. */
export const FADE_GLSL = /* glsl */ `
  uniform vec4 uFocus;
  void canopyFade(vec3 p) {
    if (uFocus.w < 0.5) return;
    vec3 a = cameraPosition;
    vec3 ab = uFocus.xyz - a;
    float t = dot(p - a, ab) / dot(ab, ab);
    if (t > 1.02) return;
    float d = length(p - (a + ab * clamp(t, 0.0, 1.0)));
    float k = (1.0 - smoothstep(0.8, 1.6, d)) * smoothstep(0.15, 0.35, t);
    float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (n < k * 0.88) discard;
  }
`;

/** A global color remap from the look: saturation, then a lift toward warm paper. */
export function albedoGlsl(v: string) {
  const a = look().albedo;
  if (a.sat === 1 && a.lift === 0) return '';
  return /* glsl */ `
    {
      float alL = dot(${v}, vec3(0.2126, 0.7152, 0.0722));
      ${v} = mix(vec3(alL), ${v}, ${f(a.sat)});
      ${v} = mix(${v}, ${v3(a.toward)} * max(alL * 1.4, 0.45), ${f(a.lift)});
    }`;
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

/** Replaces smooth shading with the look's painted tones. Keeps some of the light's hue, so dusk stays warm. */
export function celPatch(frag: string) {
  const sh = look().shading;
  const lo = sh.steps[0], hi = sh.steps[1], w = sh.softness;
  const line = 'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;';
  return 'uniform float uInkRef;\nuniform float uLight;\n' + frag.replace(line, /* glsl */ `${line}
    {
      vec3 inkAlb = max(material.diffuseColor, vec3(0.002));
      vec3 inkIll = totalDiffuse / inkAlb;
      float inkL = dot(inkIll, vec3(0.2126, 0.7152, 0.0722)) * uInkRef;
      float inkBand = ${f(sh.levels[0])}
        + ${f(sh.levels[1] - sh.levels[0])} * smoothstep(${f(lo - w)}, ${f(lo + w)}, inkL)
        + ${f(sh.levels[2] - sh.levels[1])} * smoothstep(${f(hi - w)}, ${f(hi + w)}, inkL);
      vec3 inkShade = mix(${v3(sh.shadowTint)}, vec3(1.0), smoothstep(${f(lo - w - 0.03)}, ${f(lo + w + 0.04)}, inkL));
      vec3 inkHue = mix(vec3(1.0), inkIll * uInkRef / max(inkL, 0.001), ${f(sh.lightHue)});
      totalDiffuse = inkAlb * inkHue * inkShade * inkBand * uLight;
    }`);
}

/** Shared by the outline shell. Line width is a fraction of the window height, so it looks the same at any resolution. */
export const inkShared = {
  uAspect: { value: 1 },
  uWidth: { value: 1.9 / 720 },
};

function outlineMaterial(wind: number, fade: boolean) {
  const o = look().outline;
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexColors: true,
    uniforms: { uTime: shared.uTime, uWind: { value: wind }, uAspect: inkShared.uAspect, uWidth: inkShared.uWidth, uFocus: shared.uFocus, uLight: shared.uLight },
    vertexShader: /* glsl */ `
      attribute vec3 aInk;
      uniform float uTime, uWind, uAspect, uWidth;
      varying vec3 vInkCol;
      varying vec3 vPWorld;
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
        vPWorld = (modelMatrix * im * vec4(t, 1.0)).xyz;
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
      varying vec3 vPWorld;
      uniform float uLight;
      ${fade ? FADE_GLSL : ''}
      void main() {
        ${fade ? 'canopyFade(vPWorld);' : ''}
        gl_FragColor = vec4(mix(${v3(o.color)}, vInkCol * ${v3(o.color)} * 2.0, ${f(o.albedoMix)}) * mix(0.6, 1.0, uLight), 1.0);
      }
    `,
  });
}

/** Adds the ink outline to a mesh built by MB, if the look outlines this class of object. Instanced meshes need nothing extra. */
export function inked<T extends THREE.Mesh>(mesh: T, cls: OutlineClass = 'nature'): T {
  if (!outlined(cls) || !mesh.geometry.getAttribute('aInk')) return mesh;
  const base = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
  mesh.material = [base, base === Mats.stdFoliage ? Mats.outlineFoliage : Mats.outline];
  return mesh;
}

/** Patches a standard/lambert material with the game's painterly look. */
export function paint<T extends THREE.Material>(mat: T, opts: PaintOpts = {}): T {
  const L = look();
  const wind = opts.wind ?? 0;
  const rim = (opts.rim ?? 1) * L.rim;
  const brush = (opts.brush ?? 1) * L.brush;
  const fade = !!opts.fade;
  const hasNormal = !(mat instanceof THREE.MeshLambertMaterial);
  const marks = rich() && !!opts.marks;
  const lamps = rich();
  mat.onBeforeCompile = (s) => {
    s.uniforms.uLamps = shared.uLamps;
    s.uniforms.uGlow = shared.uGlow;
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uBrush = shared.uBrush;
    s.uniforms.uRim = shared.uRim;
    s.uniforms.uInkRef = shared.uInkRef;
    s.uniforms.uLight = shared.uLight;
    s.uniforms.uFocus = shared.uFocus;
    s.uniforms.uWind = { value: wind };
    s.uniforms.uRimAmt = { value: rim };
    s.uniforms.uBrushAmt = { value: brush };
    s.vertexShader = PAINT_VERT_HEAD + (marks ? 'attribute vec4 aMark;\nvarying vec4 vMark;\nvarying vec3 vLocal;\n' : '') + s.vertexShader
      .replace('#include <begin_vertex>', /* glsl */ `
        #include <begin_vertex>
        ${marks ? 'vMark = aMark; vLocal = position;' : ''}
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
    s.fragmentShader = PAINT_FRAG_HEAD + (fade ? FADE_GLSL : '') + (marks ? MARK_GLSL : '') + (lamps ? LAMP_GLSL : '') + celPatch(s.fragmentShader)
      .replace('#include <clipping_planes_fragment>', /* glsl */ `
        #include <clipping_planes_fragment>
        ${fade ? 'canopyFade(vPWorld);' : ''}
      `)
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
        ${marks ? 'diffuseColor.rgb *= 1.0 - inkMarks();' : ''}
        ${albedoGlsl('diffuseColor.rgb')}
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */ `
        #include <emissivemap_fragment>
        ${lamps ? 'totalEmissiveRadiance += lampLight(vPWorld, diffuseColor.rgb);' : ''}
        ${hasNormal ? /* glsl */ `
        {
          float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.2);
          totalEmissiveRadiance += uRim * rimF * uRimAmt * diffuseColor.rgb * 1.6;
        }
        ` : ''}
      `);
  };
  mat.customProgramCacheKey = () => `paint-${L.id}-${wind}-${rim}-${brush}-${fade}-${marks}-${mat.type}`;
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
  const L = look();
  inkShared.uWidth.value = L.outline.width;
  Mats.std = paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 }), { marks: true });
  Mats.stdFoliage = paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), { wind: 0.0042, rim: 1.3, fade: true });
  Mats.metal = paint(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.72 }), { brush: 0.5 });
  Mats.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
  // Caps brightness while keeping the hue, and scales it with the time of day (lanterns glow at night).
  Mats.glow.onBeforeCompile = (s) => {
    s.uniforms.uGlow = shared.uGlow;
    s.fragmentShader = 'uniform float uGlow;\n' + s.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
      #include <opaque_fragment>
      gl_FragColor.rgb *= min(1.0, 1.35 / max(max(gl_FragColor.r, gl_FragColor.g), max(gl_FragColor.b, 0.001)));
      gl_FragColor.rgb *= uGlow;
    `);
  };
  Mats.glow.customProgramCacheKey = () => 'glow-time';
  Mats.outline = outlineMaterial(0, false);
  Mats.outlineFoliage = outlineMaterial(0.0042, true);
}
