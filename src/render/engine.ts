// Renderer setup: quality tiers, resize, WebGL context loss, and a light painterly post pass
// (color grade, warm tint, paper grain, vignette). Retuned in Phase 2.

import * as THREE from 'three';
import { QUALITY, type QualitySettings, type QualityTier } from '../data/quality';
import type { LightPreset } from '../data/presets';

const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = `
uniform sampler2D tScene; uniform float uSat; uniform float uWarm; uniform float uTime; uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);
  c += vec3(uWarm, uWarm * 0.45, -uWarm * 0.4);
  float grain = hash(floor(vUv * uRes / 2.0)) - 0.5;
  c += grain * 0.035;
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * 0.35;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
  tier: QualityTier;
  q: QualitySettings;
  contextLost = false;
  private target: THREE.WebGLRenderTarget | null = null;
  private post: { scene: THREE.Scene; cam: THREE.Camera; mat: THREE.ShaderMaterial } | null = null;
  private listeners: ((tier: QualityTier) => void)[] = [];

  constructor(readonly canvas: HTMLCanvasElement, tier: QualityTier) {
    this.tier = tier;
    this.q = QUALITY[tier];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.contextLost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.contextLost = false; this.setTier(this.tier, true); });
    this.applyTier();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  onTierChange(fn: (tier: QualityTier) => void): void {
    this.listeners.push(fn);
  }

  setTier(tier: QualityTier, force = false): void {
    if (tier === this.tier && !force) return;
    this.tier = tier;
    this.q = QUALITY[tier];
    this.applyTier();
    this.resize();
    for (const l of this.listeners) l(tier);
  }

  applyPreset(p: LightPreset): void {
    this.scene.fog = new THREE.Fog(p.fogColor, p.fogNear, p.fogFar);
    this.scene.background = new THREE.Color(p.skyHorizon);
    if (this.post) {
      this.post.mat.uniforms.uSat!.value = p.saturation;
      this.post.mat.uniforms.uWarm!.value = p.warmth;
    }
  }

  private applyTier(): void {
    const r = this.renderer;
    r.shadowMap.enabled = this.q.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.maxPixelRatio));
    if (this.q.painterlyPass && !this.post) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: POST_VERT,
        fragmentShader: POST_FRAG,
        uniforms: { tScene: { value: null }, uSat: { value: 1 }, uWarm: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
        depthTest: false,
        depthWrite: false,
      });
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
      this.post = { scene, cam: new THREE.Camera(), mat };
    }
    if (!this.q.painterlyPass && this.post) {
      this.post.mat.dispose();
      this.post = null;
      this.target?.dispose();
      this.target = null;
    }
    // Shadow maps are allocated lazily per light; ask lights to rebuild at the new size.
    this.scene.traverse((o) => {
      if (o instanceof THREE.DirectionalLight) {
        o.castShadow = this.q.shadows;
        o.shadow.mapSize.set(this.q.shadowMapSize, this.q.shadowMapSize);
        o.shadow.map?.dispose();
        o.shadow.map = null;
      }
    });
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.post) {
      const pr = this.renderer.getPixelRatio();
      const tw = Math.floor(w * pr), th = Math.floor(h * pr);
      if (!this.target) {
        this.target = new THREE.WebGLRenderTarget(tw, th, { samples: this.q.antialias ? 4 : 0, type: THREE.HalfFloatType });
        this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
      } else this.target.setSize(tw, th);
      this.post.mat.uniforms.uRes!.value.set(tw, th);
    }
  }

  render(time: number): void {
    if (this.contextLost) return;
    const r = this.renderer;
    if (this.post && this.target) {
      r.setRenderTarget(this.target);
      r.render(this.scene, this.camera);
      r.setRenderTarget(null);
      this.post.mat.uniforms.tScene!.value = this.target.texture;
      this.post.mat.uniforms.uTime!.value = time;
      r.render(this.post.scene, this.post.cam);
    } else {
      r.render(this.scene, this.camera);
    }
  }
}
