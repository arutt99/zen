// Copied from Lanternfall (games/lanternfall/src/render/engine.ts @ b282628).
// Changes: the quality table moved to src/data/quality.ts; the RTS camera rig was removed (Moss & Bell
// uses a follow camera, src/render/camera.ts); the field of view is set by the follow camera.
// Phase 2: the look preset (src/data/looks.ts) sets bloom, a warm grade on top of the time of day's,
// paper grain and posterizing; the Kuwahara and tilt-shift passes stay off (they belonged to
// Lanternfall's classic style).
// Renderer and post-processing chain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { QUALITY, type QualitySettings as Quality, type QualityTier as QualityId } from '../data/quality';
import type { PlacePreset as Biome } from '../data/presets';
import { inkShared, Mats } from './materials';
import { look, f } from './look';

// Removes invalid and extreme HDR values, which the bloom blur would otherwise spread across the whole frame.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    float fix(float v) { return (v == v && v < 1e6) ? clamp(v, 0.0, 24.0) : 0.0; }
    void main() { vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(fix(c.r), fix(c.g), fix(c.b), 1.0); }
  `,
};

const PaintShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uRadius: { value: 2.2 },
    uAmt: { value: 0.8 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    // Anisotropy-free four-sector Kuwahara filter: flattens detail into brush-like patches.
    uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uRadius; uniform float uAmt;
    varying vec2 vUv;
    void sector(vec2 dir, inout float bestV, inout vec3 best) {
      vec3 m = vec3(0.0); vec3 s = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
          vec2 o = vec2(float(i), float(j)) * 0.5 * uRadius * dir * uTexel;
          vec3 c = min(texture2D(tDiffuse, vUv + o).rgb, vec3(3.0));
          m += c; s += c * c;
        }
      }
      m /= 9.0; s = s / 9.0 - m * m;
      float v = s.r + s.g + s.b;
      if (v < bestV) { bestV = v; best = m; }
    }
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      float bestV = 1e9; vec3 best = src.rgb;
      sector(vec2(-1.0, -1.0), bestV, best);
      sector(vec2( 1.0, -1.0), bestV, best);
      sector(vec2(-1.0,  1.0), bestV, best);
      sector(vec2( 1.0,  1.0), bestV, best);
      // Bright magic keeps its full HDR energy for bloom.
      float keep = smoothstep(1.2, 2.6, max(src.r, max(src.g, src.b)));
      gl_FragColor = vec4(mix(src.rgb, mix(src.rgb, best, uAmt), 1.0 - keep), src.a);
    }
  `,
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uTilt: { value: 1 },
    uLift: { value: new THREE.Vector3() },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSat: { value: 1.1 },
    uVignette: { value: 0.32 },
    uTime: { value: 0 },
    uFade: { value: 0 },
    uDesat: { value: 0 },
    uGrain: { value: 0 },
    uPx: { value: 1 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uTilt, uSat, uVignette, uTime, uFade, uDesat, uGrain, uPx;
    uniform vec3 uLift, uGain;
    varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), q = fract(p);
      q = q * q * (3.0 - 2.0 * q);
      return mix(mix(rnd(i), rnd(i + vec2(1.0, 0.0)), q.x), mix(rnd(i + vec2(0.0, 1.0)), rnd(i + vec2(1.0, 1.0)), q.x), q.y);
    }
    // Still paper: a fine tooth, soft blotches and long fibres, fixed to the screen in CSS pixels.
    float paper(vec2 px) {
      return vnoise(px * 0.55) * 0.45 + vnoise(px * 0.07) * 0.35 + vnoise(vec2(px.x * 0.6 + px.y * 0.2, px.y * 0.04)) * 0.2;
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // Tilt-shift gives the battlefield the feel of a handcrafted miniature.
      float tilt = smoothstep(0.2, 0.62, abs(vUv.y - 0.5)) * uTilt * 5.5;
      if (tilt > 0.05) {
        vec3 sum = c;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.7854;
          sum += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * tilt * uTexel).rgb;
          sum += texture2D(tDiffuse, vUv + vec2(cos(a + 0.39), sin(a + 0.39)) * tilt * 0.5 * uTexel).rgb;
        }
        c = sum / 17.0;
      }
      c = c * uGain + uLift;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat * (1.0 - uDesat));
      vec2 q = vUv - 0.5;
      float v = 1.0 - dot(q, q) * 2.0 * uVignette * 2.0;
      c *= clamp(v, 0.0, 1.0);
      POSTERIZE
      if (uGrain > 0.0) {
        float pp = paper(vUv / uTexel / uPx) - 0.5;
        c *= 1.0 + pp * uGrain * 2.0;
        c += pp * uGrain * 0.08;
      }
      c += (rnd(vUv * 913.0 + uTime) - 0.5) * 0.006 * (l + 0.1);
      c *= 1.0 - uFade;
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }
  `,
};

export class Engine {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  composer!: EffectComposer;
  scene: THREE.Scene = new THREE.Scene();
  qualityId: QualityId = 'high';
  quality: Quality = QUALITY.high;
  renderScale = 1;
  painterlyOn = true;
  tiltOn = true;
  private renderPass!: RenderPass;
  private paintPass!: ShaderPass;
  private bloomPass!: UnrealBloomPass;
  private finalPass!: ShaderPass;
  private fade = 0;
  private fadeTarget = 0;
  desat = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    {
      // The outline shell has no use in the shadow map, so shadows draw each mesh once.
      const shadows = this.renderer.shadowMap;
      const renderShadows = shadows.render;
      shadows.render = (...args: Parameters<typeof renderShadows>) => {
        Mats.outline.visible = Mats.outlineFoliage.visible = false;
        renderShadows.apply(shadows, args);
        Mats.outline.visible = Mats.outlineFoliage.visible = true;
      };
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 1600);
    this.buildComposer();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private buildComposer() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: this.quality.msaa,
    });
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer, target);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.paintPass = new ShaderPass(PaintShader);
    const bl = look().post.bloom;
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), bl.strength, bl.radius, bl.threshold);
    const p = look().post;
    const fs = FinalShader.fragmentShader.replace('POSTERIZE', p.posterize > 0 ? /* glsl */ `
      {
        // Limited palette, like pigments pressed from a few blocks.
        float lv = ${f(p.posterize)};
        vec3 q = floor(c * lv + 0.5) / lv;
        c = mix(c, q, ${f(p.posterizeMix)});
      }` : '');
    this.finalPass = new ShaderPass({ ...FinalShader, fragmentShader: fs });
    this.finalPass.uniforms.uGrain.value = p.grain;
    this.finalPass.uniforms.uVignette.value = p.vignette;
    const output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.composer.addPass(this.paintPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.finalPass);
    this.composer.addPass(output);
    this.applyToggles();
    this.setGrade(this.grade);
  }

  private applyToggles() {
    // Lanternfall's classic-style passes; no look uses them (kept for a future look preset).
    this.paintPass.enabled = false;
    this.finalPass.uniforms.uTilt.value = 0;
  }

  setQuality(id: QualityId) {
    this.qualityId = id;
    this.quality = QUALITY[id];
    this.renderScale = 1;
    this.buildComposer();
    this.resize();
  }

  setToggles(painterly: boolean, tilt: boolean) {
    this.painterlyOn = painterly;
    this.tiltOn = tilt;
    this.applyToggles();
  }

  private grade: Biome['grade'] = { lift: [0, 0, 0], gain: [1, 1, 1], sat: 1 };

  setScene(scene: THREE.Scene, biome: Biome) {
    this.scene = scene;
    this.renderPass.scene = scene;
    this.setGrade(biome.grade);
  }

  /** The time of day's color grade, with the look's grade on top. */
  setGrade(g: Biome['grade']) {
    this.grade = g;
    const p = look().post;
    this.finalPass.uniforms.uLift.value.set(g.lift[0] + p.lift[0], g.lift[1] + p.lift[1], g.lift[2] + p.lift[2]);
    this.finalPass.uniforms.uGain.value.set(g.gain[0] * p.gain[0], g.gain[1] * p.gain[1], g.gain[2] * p.gain[2]);
    this.finalPass.uniforms.uSat.value = g.sat * p.sat;
  }

  /** Scales rendering resolution, used by automatic performance adjustment. */
  setRenderScale(s: number) {
    this.renderScale = s;
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dpr) * this.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    const texel = 1 / (w * dpr);
    const texelY = 1 / (h * dpr);
    this.paintPass.uniforms.uTexel.value.set(texel, texelY);
    this.finalPass.uniforms.uTexel.value.set(texel, texelY);
    this.finalPass.uniforms.uPx.value = dpr;
    this.paintPass.uniforms.uRadius.value = 2.4 * Math.max(1, dpr * 0.8);
    this.camera.aspect = w / h;
    inkShared.uAspect.value = w / h;
    // Narrow windows widen the view a little so the caretaker's surroundings stay readable.
    this.camera.fov = w / h < 1.6 ? 34 * Math.min(1.35, 1.6 / (w / h)) : 34;
    this.camera.updateProjectionMatrix();
  }

  fadeTo(v: number) {
    this.fadeTarget = v;
  }

  render(dt: number, time: number) {
    this.fade += (this.fadeTarget - this.fade) * (1 - Math.exp(-dt * 7));
    const u = this.finalPass.uniforms;
    u.uFade.value = this.fade;
    u.uTime.value = time % 10;
    u.uDesat.value = this.desat;
    this.composer.render(dt);
  }
}
