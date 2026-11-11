// Adapted from Lanternfall (games/lanternfall/src/render/stage.ts @ b282628).
// Builds the floating island diorama for a place: terrain, water, sky, foliage, and props.
// Changes: reads an IslandWorld + PlacePreset instead of a tower-defense World + Biome; the lantern,
// rifts, explosion lights, windmills and the build-grid overlay are gone; the road is a packed-earth
// path (no cobbles); grass, flower and ambient counts scale with the island's area; lily pads always
// appear; a 'petals' ambient was added.
// Phase 2: the look preset (src/data/looks.ts) sets the ground's patch and path edges, grass density,
// haze and a global color remap; `applyLight` changes sun, sky, fog, water and ambient particles live
// for the time of day (src/core/daylight.ts); fireflies fade in at night.
// Painted+ (2026-11-10): soft contact shadows on the ground under props, nodes and build sites
// (src/render/contact.ts), softer sun shadow edges, and stones along the pond's edge.
import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { contactField, footprintOf, type Footprint } from './contact';
import { f, fine, look, rich } from './look';
import { dressingGeos, dressingPlan, DRESS_KINDS, Life, staticLamps } from './rich';
import { clamp, DataUtilsHalf, fbm, makeRng, smoothstep } from '../core/util-render';
import type { IslandWorld } from '../sim/island';
import type { PlacePreset as Biome } from '../data/presets';
import type { QualitySettings as Quality } from '../data/quality';
import { decorGeo, stone as stoneShape } from './decor-models';
import type { OutlineClass } from '../data/looks';
import { inkRef, lightLevel } from '../core/daylight';
import { DEFAULT_PALETTE, seasonLook, type SeasonLook } from '../data/seasons';

const colorOf = (hex: number) => new THREE.Color(hex);
const LIGHT_SHAFTS = false as boolean;
/** Lanternfall's counts are tuned for its 140 x 104 m battlefields. */
const LANTERNFALL_AREA = 70 * 52;
import { albedoGlsl, LAMP_GLSL, LAMPS, Mats, paint, shared, celPatch, inked } from './materials';
import { MB } from './mb';

const TERRAIN_FRAG_HEAD = /* glsl */ `
  varying vec3 vPWorld;
  varying vec3 vPNormal;
  uniform sampler2D uBrush, uField;
  uniform vec2 uExt;
  uniform vec3 uGroundA, uGroundB, uGroundC, uRockA, uRockB, uRoadA, uRoadB, uShore, uPeak;
  uniform float uPeakH, uCobble, uPathW, uWaterLevel, uHasWater, uTime;
  uniform vec4 uRing; uniform vec3 uRingColor;
  uniform vec4 uRing2; uniform vec3 uRing2Color;
  uniform vec3 uRim;
  uniform sampler2D uContact;
  uniform float uSiteShade;
  uniform float uHeal;
  uniform vec4 uCover; uniform vec3 uCover2;

  vec2 hash22(vec2 p) {
    vec3 a = fract(p.xyx * vec3(123.34, 234.34, 345.65));
    a += dot(a, a + 34.45);
    return fract(vec2(a.x * a.y, a.y * a.z));
  }
  // Cell distance for rounded cobblestones along the roads.
  vec3 cobbles(vec2 p) {
    vec2 ip = floor(p), fp = fract(p);
    float d1 = 8.0, d2 = 8.0; vec2 idc = vec2(0.0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(ip + g);
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; idc = ip + g; }
      else if (d < d2) { d2 = d; }
    }
    return vec3(sqrt(d2) - sqrt(d1), hash22(idc));
  }
`;

const WATER_VERT = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const WATER_FRAG = /* glsl */ `
  uniform sampler2D uBrush, uField;
  uniform vec2 uExt;
  uniform vec3 uShallow, uDeep, uSky, uSun, uFog, uFoam;
  uniform vec3 uSunDir;
  uniform float uTime, uLava, uFogDensity, uLevel, uMurk;
  varying vec3 vW;
  void main() {
    vec2 fuv = (vW.xz + uExt) / (2.0 * uExt);
    float h = texture2D(uField, fuv).g;
    if (h < -5.0 || h > uLevel + 0.08) discard;
    float depth = clamp(uLevel - h, 0.0, 2.2);
    float t = uTime;
    vec3 col; float alpha;
    if (uLava > 0.5) {
      vec2 p = vW.xz * 0.05;
      float n1 = texture2D(uBrush, p + vec2(t * 0.012, t * 0.006)).r;
      float n2 = texture2D(uBrush, p * 2.3 - vec2(t * 0.018, -t * 0.012) + n1 * 0.15).r;
      float n3 = texture2D(uBrush, p * 5.1 + vec2(t * 0.02) + n2 * 0.08).r;
      float m = smoothstep(0.4, 0.62, n1 * 0.45 + n2 * 0.35 + n3 * 0.2);
      float pulse = 0.85 + 0.15 * sin(t * 0.8 + n1 * 9.0);
      col = mix(vec3(0.16, 0.03, 0.02), uDeep * 2.0, m);
      col = mix(col, uShallow * 4.2, smoothstep(0.54, 0.7, n1 * 0.4 + n2 * 0.4 + n3 * 0.2)) * pulse;
      col += uShallow * 2.5 * smoothstep(0.35, 0.0, depth);
      alpha = 1.0;
    } else {
      vec2 p = vW.xz;
      vec2 s1 = p * 0.11 + vec2(t * 0.013, t * 0.009);
      vec2 s2 = p * 0.27 - vec2(t * 0.021, -t * 0.012);
      float n1 = texture2D(uBrush, s1).r;
      float n2 = texture2D(uBrush, s2).r;
      vec3 nrm = normalize(vec3((n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.45, 1.0, (n2 - 0.5) * 0.55 - (n1 - 0.5) * 0.45));
      vec3 view = normalize(cameraPosition - vW);
      float fres = pow(1.0 - clamp(dot(view, nrm), 0.0, 1.0), 3.0);
      col = mix(uShallow, uDeep, smoothstep(0.0, 1.5, depth));
      col = mix(col, uSky, fres * 0.75 + 0.05);
      vec3 hv = normalize(uSunDir + view);
      float spec = pow(max(dot(nrm, hv), 0.0), 170.0);
      col += uSun * smoothstep(0.5, 0.6, spec) * 0.4;
      // Stylized foam ripples washing against the shore.
      float wave = sin(depth * 11.0 - t * 1.3 + n1 * 7.0);
      float foam = smoothstep(0.7, 0.98, wave) * smoothstep(0.26, 0.04, depth) * 0.7;
      foam += smoothstep(0.08, 0.0, depth);
      col = mix(col, uFoam * 0.8, clamp(foam, 0.0, 1.0) * 0.6);
      RICH_WATER
      // An unrestored pond is murky: a dull green-brown film, less sky, more opaque (plan 3.4, "water clears").
      float murkN = texture2D(uBrush, p * 0.06 + vec2(t * 0.004)).r;
      col = mix(col, mix(vec3(0.27, 0.31, 0.2), vec3(0.36, 0.38, 0.24), murkN), uMurk * (0.75 + murkN * 0.25));
      alpha = smoothstep(0.0, 0.3, depth) * 0.42 + 0.56 + uMurk * 0.3;
    }
    float d = length(cameraPosition - vW);
    float fog = 1.0 - exp(-d * d * uFogDensity * uFogDensity);
    gl_FragColor = vec4(mix(col, uFog, fog), alpha);
  }
`;

/**
 * Lanternfall+ pond: the grassy bank mirrored softly near the shore, slow inked ripple rings spreading
 * from a few spots (a fish rising, a drop from a leaf), and an inked line where water meets ground.
 */
const RICH_WATER_GLSL = /* glsl */ `
  {
    col = mix(col, uBank, (1.0 - smoothstep(0.1, 0.9, depth)) * 0.3 * (1.0 - fres));
    for (int i = 0; i < 5; i++) {
      vec3 rp = uRipples[i];
      float age = mod(t + rp.z, 7.0);
      float rad = age * 0.32;
      float dd = length(vW.xz - rp.xy);
      float fadeR = (1.0 - smoothstep(1.0, 2.1, rad)) * smoothstep(0.0, 0.3, age);
      float w1 = fwidth(dd) * 1.4;
      float ring = 1.0 - smoothstep(w1, w1 * 2.2, abs(dd - rad));
      float ring2 = 1.0 - smoothstep(w1, w1 * 2.2, abs(dd - rad * 0.72));
      col = mix(col, uInk, ring * fadeR * 0.55);
      col = mix(col, uFoam, ring2 * fadeR * 0.35);
    }
    float rim = h - uLevel;
    float wl = fwidth(rim) * 1.6;
    col = mix(col, uInk, (1.0 - smoothstep(wl, wl * 2.0, abs(rim - 0.045))) * 0.85);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith, uHorizon, uLow, uSun, uSunDir, uCloud;
  uniform sampler2D uBrush;
  uniform float uTime, uAurora, uStars;
  varying vec3 vDir;
  float rnd(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 col = y > 0.0 ? mix(uHorizon, uZenith, pow(clamp(y * 1.15, 0.0, 1.0), 0.55)) : mix(uHorizon, uLow, pow(clamp(-y * 4.0, 0.0, 1.0), 0.6));
    float s = max(dot(d, uSunDir), 0.0);
    col += uSun * (pow(s, 6.0) * 0.16 + pow(s, 60.0) * 0.45 + pow(s, 900.0) * 3.0);
    if (y > 0.0) {
      vec2 p = d.xz / (y + 0.22);
      float n = texture2D(uBrush, p * 0.08 + vec2(uTime * 0.0016, 0.0)).r * 0.6 + texture2D(uBrush, p * 0.2 - vec2(uTime * 0.0024, 0.0)).r * 0.4;
      float c = smoothstep(0.48, 0.66, n) * smoothstep(0.0, 0.3, y) * 0.75;
      col = mix(col, uCloud * (0.86 + s * 0.4), c);
      if (uStars > 0.0) {
        vec3 cell = floor(d * 170.0);
        float st = step(0.9965, rnd(cell)) * smoothstep(0.08, 0.5, y) * (1.0 - c);
        col += vec3(0.9, 0.95, 1.0) * st * uStars * (0.5 + 0.5 * sin(uTime * 2.0 + rnd(cell + 3.0) * 30.0));
      }
      if (uAurora > 0.0) {
        float band = sin(p.x * 1.8 + uTime * 0.14 + texture2D(uBrush, p * 0.05).r * 7.0) * 0.5 + 0.5;
        float a = pow(band, 4.0) * smoothstep(0.06, 0.32, y) * smoothstep(0.9, 0.35, y);
        col += mix(vec3(0.1, 0.9, 0.6), vec3(0.6, 0.25, 0.95), clamp(y * 1.5, 0.0, 1.0)) * a * 0.5;
      }
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const CLOUD_FRAG = /* glsl */ `
  uniform sampler2D uBrush;
  uniform vec3 uLit, uShade, uFade, uSunDir;
  uniform float uTime, uAlpha, uScale, uSpeed;
  varying vec3 vW;
  void main() {
    vec2 p = vW.xz * 0.0021 * uScale;
    vec2 wind = vec2(uTime * 0.0024, uTime * 0.0011) * uSpeed;
    float n = texture2D(uBrush, p + wind).r * 0.52 + texture2D(uBrush, p * 2.7 - wind * 1.6).r * 0.3 + texture2D(uBrush, p * 6.9 + wind * 2.2).r * 0.18;
    vec2 lp = p + uSunDir.xz * 0.012;
    float nl = texture2D(uBrush, lp + wind).r * 0.52 + texture2D(uBrush, lp * 2.7 - wind * 1.6).r * 0.3 + texture2D(uBrush, lp * 6.9 + wind * 2.2).r * 0.18;
    float d = smoothstep(0.42, 0.6, n);
    float lit = clamp(0.5 + (n - nl) * 6.0, 0.0, 1.0);
    vec3 col = mix(uShade, uLit, lit * 0.8 + d * 0.2);
    float dist = length(vW.xz);
    float fade = smoothstep(800.0, 190.0, dist);
    col = mix(uFade, col, fade);
    gl_FragColor = vec4(col, d * uAlpha * mix(0.65, 1.0, fade));
  }
`;

const RAY_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uTime, uSeed;
  varying vec2 vUv; varying float vFace;
  void main() {
    float across = sin(vUv.x * 3.14159);
    float along = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
    float flick = 0.68 + 0.32 * sin(uTime * 0.35 + uSeed * 9.0);
    gl_FragColor = vec4(uColor, pow(across, 2.4) * along * flick * 0.1 * smoothstep(0.12, 0.5, vFace));
  }
`;

const AMBIENT_VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime, uScale, uSize, uPulse, uWobble;
  uniform vec3 uVel, uBox;
  varying float vA;
  void main() {
    vec3 p = position + uVel * uTime * (0.6 + aSeed.w * 0.8);
    p.x += sin(uTime * 0.5 * (0.5 + aSeed.x) + aSeed.y * 6.28) * uWobble;
    p.z += cos(uTime * 0.42 * (0.5 + aSeed.y) + aSeed.z * 6.28) * uWobble;
    p.y += sin(uTime * 0.8 * (0.5 + aSeed.z) + aSeed.x * 6.28) * uWobble * 0.4;
    // Wrap inside the box so the volume always stays full.
    p = mod(p + uBox, uBox * 2.0) - uBox;
    p.y += uBox.y;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    float pulse = uPulse > 0.0 ? pow(0.5 + 0.5 * sin(uTime * uPulse * (0.6 + aSeed.x) + aSeed.z * 40.0), 3.0) : 1.0;
    float edgeY = smoothstep(0.0, 2.0, p.y + 4.0);
    vA = pulse * edgeY;
    gl_PointSize = min(uSize * (0.5 + aSeed.w) * uScale / -mv.z, 48.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const AMBIENT_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(1.0 - d, 0.0), 2.0);
    gl_FragColor = vec4(uColor, a * vA * uAlpha);
  }
`;

/** Lanternfall+: spots in the pond that send out ripple rings now and then (x, z, time offset). */
function ripples(w: IslandWorld): THREE.Vector3[] {
  const p = w.place.pond;
  const rng = makeRng(w.seed + 404);
  return Array.from({ length: 5 }, (_, i) => {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * p.r * 0.55;
    return new THREE.Vector3(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, i * 1.4 + rng());
  });
}

export class Stage {
  scene = new THREE.Scene();
  biome: Biome;
  uniforms: Record<string, THREE.IUniform> = {};
  sun: THREE.DirectionalLight;
  private disposables: { dispose(): void }[] = [];
  private islets: { obj: THREE.Object3D; y: number; phase: number }[] = [];
  private ambientMats: { mat: THREE.ShaderMaterial; key: 'pollen' | 'fireflies' | 'fall'; alpha: number }[] = [];
  private hemi!: THREE.HemisphereLight;
  private skyU!: Record<string, THREE.IUniform>;
  private cloudU: Record<string, THREE.IUniform>[] = [];
  private waterU?: Record<string, THREE.IUniform>;
  private envU?: Record<string, THREE.IUniform>;
  private sunDir = new THREE.Vector3();
  /** Fog density of the current light, before the mist boost. */
  baseFog = 0.004;
  private fieldTex!: THREE.DataTexture;
  private waterFog?: THREE.IUniform<number>;

  /** Phase 5: the season's look (falling petals, leaves or snow; butterflies; drifting leaf colors). */
  readonly season: SeasonLook;

  constructor(public world: IslandWorld, preset: Biome, public q: Quality, pixelRatio: number, season?: SeasonLook) {
    this.biome = preset;
    this.season = season ?? seasonLook(DEFAULT_PALETTE, 'spring');
    const b = this.biome;
    this.scene.fog = new THREE.FogExp2(b.fog, b.fogDensity * look().haze.density);
    this.scene.background = null;

    const sunDir = new THREE.Vector3(...b.sunDir).normalize();
    this.sun = new THREE.DirectionalLight(b.sunColor, b.sunI);
    this.sun.position.copy(sunDir).multiplyScalar(170);
    this.sun.castShadow = true;
    const ext = world.extW * 1.04;
    const cam = this.sun.shadow.camera;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; cam.near = 20; cam.far = 340;
    this.sun.shadow.mapSize.set(q.shadow, q.shadow);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = look().light.shadowSoftness;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(b.hemiSky, b.hemiGround, b.hemiI);
    this.scene.add(this.hemi);
    this.sunDir.copy(sunDir);

    this.buildField();
    this.buildContact();
    this.buildTerrain();
    if (world.hasWater) this.buildWater();
    this.buildSky();
    this.buildDecor();
    this.buildGrass();
    this.buildRoadside();
    if (fine() && world.hasWater) this.buildPondEdge();
    if (rich()) this.buildRich();
    this.buildIslets();
    // Lanternfall's light shafts belonged to its classic style; no look uses them yet (kept for a later preset).
    if (LIGHT_SHAFTS && q.rays && b.rays > 0) this.buildRays(sunDir);
    this.buildAmbient(pixelRatio);
    this.buildEnvironment();
    this.applyLight(b);
  }

  /**
   * Sets the time of day's light, sky, fog, water and ambient particles (src/core/daylight.ts blends
   * the preset). Ground colors stay; light and the look's shading do the rest.
   */
  applyLight(p: Biome) {
    const L = look();
    this.sun.color.set(p.sunColor);
    this.sun.intensity = p.sunI;
    this.sunDir.set(...p.sunDir).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(170);
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemiI;
    shared.uRim.value.set(p.rim);
    shared.uInkRef.value = inkRef(p);
    shared.uLight.value = lightLevel(p);
    shared.uGlow.value = p.glow;
    // Haze: the look thickens fog a little and pulls its color toward warm paper.
    const fogCol = colorOf(p.fog).lerp(colorOf(0xf2e4c8), L.haze.paper * 0.35 * shared.uLight.value);
    (this.scene.fog as THREE.FogExp2).color.copy(fogCol);
    this.baseFog = p.fogDensity * L.haze.density;
    const sk = this.skyU;
    (sk.uZenith!.value as THREE.Color).set(p.zenith);
    (sk.uHorizon!.value as THREE.Color).set(p.horizon);
    (sk.uLow!.value as THREE.Color).set(p.low);
    (sk.uSun!.value as THREE.Color).set(p.sunColor);
    (sk.uCloud!.value as THREE.Color).set(p.cloudLit);
    sk.uStars!.value = p.stars;
    for (const c of this.cloudU) {
      (c.uLit!.value as THREE.Color).set(p.cloudLit);
      (c.uShade!.value as THREE.Color).set(p.cloudShade);
      (c.uFade!.value as THREE.Color).set(p.low);
    }
    if (this.waterU) {
      const w = this.waterU;
      (w.uShallow!.value as THREE.Color).set(p.waterShallow);
      (w.uDeep!.value as THREE.Color).set(p.waterDeep);
      (w.uSky!.value as THREE.Color).set(p.zenith).lerp(colorOf(p.horizon), 0.6);
      (w.uSun!.value as THREE.Color).set(p.sunColor);
      (w.uFog!.value as THREE.Color).copy(fogCol);
      (w.uFoam!.value as THREE.Color).set(0xffffff).lerp(colorOf(p.horizon), 0.2).multiplyScalar(0.5 + 0.5 * shared.uLight.value);
    }
    for (const a of this.ambientMats) {
      a.mat.uniforms.uAlpha!.value = a.alpha * (a.key === 'pollen' ? p.pollen : a.key === 'fireflies' ? p.fireflies : 1);
    }
    if (this.envU) {
      (this.envU.a!.value as THREE.Color).set(p.zenith);
      (this.envU.c!.value as THREE.Color).set(p.horizon);
      (this.envU.l!.value as THREE.Color).set(p.hemiGround);
      (this.envU.s!.value as THREE.Color).set(p.sunColor);
      this.envI = p.envI;
      this.scene.environmentIntensity = p.envI;
    }
  }

  private track<T extends { dispose(): void }>(d: T): T {
    this.disposables.push(d);
    return d;
  }

  private buildEnvironment() {
    // Soft sky-colored image-based light. Gives metal something to reflect.
    const b = this.biome;
    const envScene = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: this.envU = { a: { value: colorOf(b.zenith) }, c: { value: colorOf(b.horizon) }, l: { value: colorOf(b.hemiGround) }, s: { value: colorOf(b.sunColor) }, d: { value: this.sunDir } },
      vertexShader: `varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 a,c,l,s,d; varying vec3 v; void main(){ vec3 n=normalize(v); vec3 col = n.y>0.0? mix(c,a,pow(n.y,0.6)) : mix(c,l,pow(-n.y,0.5)); col += s*pow(max(dot(n,d),0.0),24.0)*5.0; gl_FragColor=vec4(col,1.0);} `,
    });
    envScene.add(new THREE.Mesh(this.track(new THREE.SphereGeometry(10, 24, 16)), this.track(mat)));
    this.envScene = envScene;
    this.envI = b.envI;
  }
  envScene: THREE.Scene | null = null;
  envI = 0.4;

  /** Must be called with the renderer once before first use. */
  bakeEnvironment(renderer: THREE.WebGLRenderer) {
    if (!this.envScene || this.envRT) return;
    const gen = new THREE.PMREMGenerator(renderer);
    const rt = gen.fromScene(this.envScene, 0.04);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = this.envI;
    gen.dispose();
    this.track(rt);
    this.envRT = rt;
  }

  /** Bakes the sky lighting again after the graphics context was lost, which erased it. */
  rebakeEnvironment(renderer: THREE.WebGLRenderer) {
    this.envRT?.dispose();
    this.envRT = null;
    this.bakeEnvironment(renderer);
  }
  private envRT: THREE.WebGLRenderTarget | null = null;

  private buildField() {
    const w = this.world;
    const fw = Math.ceil(w.extW * 2 * 2) + 1;
    const fh = Math.ceil(w.extH * 2 * 2) + 1;
    const data = new Uint16Array(fw * fh * 4);
    let k = 0;
    for (let j = 0; j < fh; j++) {
      for (let i = 0; i < fw; i++) {
        const x = (i / (fw - 1)) * w.extW * 2 - w.extW;
        const z = (j / (fh - 1)) * w.extH * 2 - w.extH;
        data[k++] = DataUtilsHalf(w.roadDistance(x, z));
        data[k++] = DataUtilsHalf(w.height(x, z));
        data[k++] = 0;
        data[k++] = DataUtilsHalf(1);
      }
    }
    const tex = new THREE.DataTexture(data, fw, fh, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.fieldTex = this.track(tex);

  }

  private contactTex: THREE.DataTexture | null = null;
  /** How much of the build sites' contact shadow shows (0 = nothing built, 1 = the deck stands). */
  private siteShade = { value: 0 };

  /** Paints the soft contact shadows of decor, gather nodes and build sites into a ground texture (Painted+). */
  private buildContact() {
    if (look().light.contact <= 0) return;
    const w = this.world;
    const prints: Footprint[] = [];
    for (const b of w.blockers) {
      const geo = decorGeo(b.kind);
      if (geo.floats || geo.flat) continue;
      prints.push(footprintOf(geo.solid, b.x, b.z, b.rot, b.scale, geo.ink === 'building' ? 0.7 : 0.9));
      // A broad, faint shade under a crown: the sky is partly hidden there.
      if (geo.leaf) {
        const fp = footprintOf(geo.leaf, b.x, b.z, b.rot, b.scale * 0.85, 0.3);
        if (fp.hx > 0.6) prints.push(fp);
      }
    }
    for (const n of w.place.nodes) {
      const r = n.kind === 'tree' ? 0.5 : n.kind === 'bamboo' ? 0.65 : 1.0;
      prints.push({ x: n.x, z: n.z, hx: r, hz: r, rot: 0, k: 0.85 });
    }
    for (const st of w.place.sites) {
      const r = (BUILDINGS[st.building]?.solidRadius ?? 1.5) * 0.92;
      this.sitePrints.set(st.id, { x: st.x, z: st.z, hx: r, hz: r * 0.88, rot: st.rot ?? 0, k: 0.8, site: true });
    }
    const field = contactField(w.extW, w.extH, prints);
    this.contactData = field.data;
    const tex = new THREE.DataTexture(field.data, field.w, field.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.contactTex = this.track(tex);
  }

  private sitePrints = new Map<string, Footprint>();
  private siteWeights = new Map<string, number>();
  private contactData: Uint8Array | null = null;

  /**
   * Shows each build site's contact shadow as its building goes up (0..1 per site id). The sites' channel
   * is repainted only when a weight has moved noticeably (a deck settling), never every frame.
   */
  setSiteShades(weights: ReadonlyMap<string, number>) {
    this.siteShade.value = 1;
    if (!this.contactData || !this.contactTex) return;
    let changed = false;
    for (const [id, v] of weights) if (Math.abs((this.siteWeights.get(id) ?? 0) - v) > 0.04 || (v === 0) !== ((this.siteWeights.get(id) ?? 0) === 0)) changed = true;
    if (!changed) return;
    for (const [id, v] of weights) this.siteWeights.set(id, v);
    const prints = [...this.sitePrints].filter(([id]) => (this.siteWeights.get(id) ?? 0) > 0).map(([id, p]) => ({ ...p, k: p.k * this.siteWeights.get(id)! }));
    const field = contactField(this.world.extW, this.world.extH, prints);
    const d = this.contactData;
    for (let i = 1; i < d.length; i += 4) d[i] = field.data[i]!;
    this.contactTex.needsUpdate = true;
  }

  private buildTerrain() {
    const w = this.world;
    const b = this.biome;
    const step = this.q.terrainStep;
    const inkGround = true;
    const G = look().ground;
    const ps = G.patchSoftness;
    const contactK = this.contactTex ? look().light.contact : 0;
    const inkTint = `vec3(${b.ink.tint.map((v) => v.toFixed(3)).join(', ')})`;
    const nx = Math.ceil((w.extW * 2) / step) + 1;
    const nz = Math.ceil((w.extH * 2) / step) + 1;
    const pos = new Float32Array(nx * nz * 3);
    const nrm = new Float32Array(nx * nz * 3);
    let k = 0;
    const e = 0.6;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = -w.extW + i * step;
        const z = -w.extH + j * step;
        const y = w.height(x, z);
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
        const hl = w.height(x - e, z), hr = w.height(x + e, z), hd = w.height(x, z - e), hu = w.height(x, z + e);
        const nl = Math.hypot(hl - hr, 2 * e, hd - hu);
        nrm[k] = (hl - hr) / nl; nrm[k + 1] = (2 * e) / nl; nrm[k + 2] = (hd - hu) / nl;
        k += 3;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, c = a + nx, bb = a + 1, d = c + 1;
        if (pos[a * 3 + 1] < -26 && pos[bb * 3 + 1] < -26 && pos[c * 3 + 1] < -26 && pos[d * 3 + 1] < -26) continue;
        idx.push(a, c, bb, bb, c, d);
      }
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    this.track(geo);

    const u: Record<string, THREE.IUniform> = {
      uBrush: shared.uBrush,
      uTime: shared.uTime,
      uRim: shared.uRim,
      uInkRef: shared.uInkRef,
      uLight: shared.uLight,
      uField: { value: this.fieldTex },
      uExt: { value: new THREE.Vector2(w.extW, w.extH) },
      uGroundA: { value: colorOf(b.groundA) },
      uGroundB: { value: colorOf(b.groundB) },
      uGroundC: { value: colorOf(b.groundC) },
      uRockA: { value: colorOf(b.rockA) },
      uRockB: { value: colorOf(b.rockB) },
      uRoadA: { value: colorOf(b.pathA) },
      uRoadB: { value: colorOf(b.pathB) },
      uShore: { value: colorOf(b.shore) },
      uPeak: { value: colorOf(b.peak) },
      uPeakH: { value: b.peakH },
      uCobble: { value: 0 },
      uPathW: { value: w.pathWidth },
      uWaterLevel: { value: w.waterLevel },
      uHasWater: { value: w.hasWater ? 1 : 0 },
      uRing: { value: new THREE.Vector4(0, 0, 0, 0) },
      uRingColor: { value: new THREE.Color(0xffe2a0) },
      uRing2: { value: new THREE.Vector4(0, 0, 0, 0) },
      uRing2Color: { value: new THREE.Color(0xffffff) },
      uContact: { value: this.contactTex },
      uSiteShade: this.siteShade,
      uHeal: this.heal,
      uCover: shared.uCover,
      uCover2: shared.uCover2,
    };
    this.uniforms = u;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 });
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = `varying vec3 vPWorld; varying vec3 vPNormal;\n` + s.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vPWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vPNormal = normal;`,
      );
      if (rich()) { s.uniforms.uLamps = shared.uLamps; s.uniforms.uGlow = shared.uGlow; }
      s.fragmentShader = TERRAIN_FRAG_HEAD + (rich() ? LAMP_GLSL : '') + celPatch(s.fragmentShader)
        .replace('#include <color_fragment>', /* glsl */ `
          #include <color_fragment>
          vec2 fuv = (vPWorld.xz + uExt) / (2.0 * uExt);
          float roadD = texture2D(uField, fuv).r;
          float n1 = texture2D(uBrush, vPWorld.xz * 0.033).r;
          float n2 = texture2D(uBrush, vPWorld.xz * 0.13 + 0.3).r;
          float n3 = texture2D(uBrush, vPWorld.xz * 0.47 + 0.6).r;
          float hgt = vPWorld.y;
          vec3 col = mix(uGroundA, uGroundB, smoothstep(0.36, 0.64, n1 * 0.7 + n2 * 0.3));
          col = mix(col, uGroundC, smoothstep(0.52, 0.68, n2 * 0.6 + n3 * 0.4) * 0.62);
          col *= 0.9 + n3 * 0.22;
          ${inkGround ? /* glsl */ `
          // Broad painted patches with crisp edges in place of fine noise.
          float inkPat = n1 * 0.72 + n2 * 0.28 + (n3 - 0.5) * 0.015;
          col = mix(uGroundA * ${inkTint} * 0.94, uGroundB * ${inkTint}, smoothstep(${f(0.4625 - ps)}, ${f(0.4625 + ps)}, inkPat));
          col = mix(col, mix(uGroundB * 1.12, uGroundC, ${b.ink.high.toFixed(2)}) * ${inkTint}, smoothstep(${f(0.5325 - ps)}, ${f(0.5325 + ps)}, inkPat));
          ` : ''}
          // An unrestored valley is tired ground (plan 3.4): duller, browner patches over the floor that
          // green up as restoration rises. uHeal: 0 neglected .. 1 restored.
          {
            float tired = (1.0 - uHeal) * smoothstep(0.38, 0.62, n2 * 0.6 + n3 * 0.4);
            col = mix(col, col * vec3(1.06, 0.92, 0.66) + vec3(0.03, 0.02, 0.0), tired * 0.75);
          }
          // Phase 5: ground cover for the season (petals, fallen leaves, snow drifts): crisp little speckles
          // that gather in clumps, a little on the path too.
          float coverK = 0.0;
          if (uCover.w > 0.0) {
            float c1 = texture2D(uBrush, vPWorld.xz * 0.93 + 0.17).r;
            float c2 = texture2D(uBrush, vPWorld.xz * 2.4 + 0.41).r;
            float clump = smoothstep(0.32, 0.62, n1 * 0.6 + n2 * 0.4);
            float cv = 0.5 + (c1 * 0.55 + c2 * 0.45 - 0.5) * 2.4;
            float th = 0.8 - uCover.w * 0.34 * (0.4 + clump);
            coverK = smoothstep(th, th + 0.02, cv);
          }
          // Cliffs and steep slopes, with layered strata.
          float slope = 1.0 - clamp(vPNormal.y, 0.0, 1.0);
          float rock = smoothstep(0.2, 0.46, slope + (n2 - 0.5) * 0.14);
          float strata = 0.5 + 0.5 * sin(hgt * 2.3 + n1 * 5.0 + n3 * 1.4);
          vec3 rockCol = ${inkGround ? 'mix(uRockA, uRockB, smoothstep(0.45, 0.52, strata) * 0.8 + 0.1)' : 'mix(uRockA, uRockB, strata * 0.75 + n3 * 0.25)'};
          col = mix(col, rockCol, rock);
          // Beaches.
          if (uHasWater > 0.5) {
            float shore = 1.0 - smoothstep(${inkGround ? 'uWaterLevel + 0.4, uWaterLevel + 0.46' : 'uWaterLevel + 0.03, uWaterLevel + 0.72'}, hgt + (n2 - 0.5) * 0.42);
            col = mix(col, uShore, shore * (1.0 - rock * 0.6));
          }
          // Snowcaps or lighter peaks on the surrounding mountains.
          col = mix(col, uPeak, smoothstep(uPeakH, uPeakH + 2.4, hgt + (n2 - 0.5) * 2.8) * (1.0 - rock * 0.45));
          // The road: packed earth and worn cobbles with a soft trampled margin.
          float edge = uPathW * 0.5 + ${inkGround ? '(n2 - 0.5) * 0.7' : '(n3 - 0.5) * 0.65 + (n2 - 0.5) * 0.85'};
          float roadMask = 1.0 - smoothstep(${f(-G.pathSoftness)} + edge, edge + ${f(G.pathSoftness)}, roadD);
          float margin = 1.0 - smoothstep(edge, edge + 1.6, roadD);
          col = mix(col, col * vec3(0.76, 0.72, 0.64), margin * (1.0 - roadMask));
          vec3 roadCol = mix(uRoadB, uRoadA, n3 * 0.6 + n2 * 0.4);
          if (uCobble > 0.0) {
            vec3 cb = cobbles(vPWorld.xz * 1.45);
            float patchy = ${inkGround ? 'smoothstep(0.535, 0.55, n2 * 0.7 + n1 * 0.3)' : 'smoothstep(0.5 - uCobble * 0.42, 0.72 - uCobble * 0.3, n2 * 0.7 + n1 * 0.3)'};
            vec3 stone = mix(uRoadA, uRoadB, cb.y * 0.7) * (0.84 + cb.z * 0.32);
            stone = mix(uRoadB * 0.55, stone, smoothstep(0.03, 0.14, cb.x));
            roadCol = mix(roadCol, stone, patchy);
          }
          ${inkGround ? /* glsl */ `
          // A worn, lighter center and a drawn edge, so the road reads at a glance.
          roadCol *= 0.92 + 0.26 * (1.0 - smoothstep(0.0, edge * 0.8, roadD));
          ` : ''}
          col = mix(col, roadCol, roadMask);
          col = mix(col, mix(uCover.rgb, uCover2, step(0.5, texture2D(uBrush, vPWorld.xz * 3.1).r)), coverK * (1.0 - rock) * (1.0 - roadMask * 0.6));
          ${inkGround ? /* glsl */ `
          float inkEdge = smoothstep(edge - 0.2, edge - 0.08, roadD) * (1.0 - smoothstep(edge + 0.02, edge + 0.14, roadD));
          col = mix(col, vec3(0.12, 0.06, 0.035), inkEdge * ${f(G.pathInk)});
          ` : ''}
          ${contactK > 0 ? /* glsl */ `
          {
            // Soft, warm contact shadows under props, trees and buildings (Painted+).
            vec4 cf = texture2D(uContact, fuv);
            float occ = pow(clamp(cf.r + cf.g * uSiteShade, 0.0, 1.0), 0.75) * ${f(contactK)};
            col *= mix(vec3(1.0), vec3(0.42, 0.35, 0.29), occ);
          }` : ''}
          ${albedoGlsl('col')}
          diffuseColor.rgb = col;
        `)
        .replace('#include <emissivemap_fragment>', /* glsl */ `
          #include <emissivemap_fragment>
          {
            // Range rings conform to the ground because they are drawn in the terrain shader.
            if (uRing.w > 0.001) {
              float d = length(vPWorld.xz - uRing.xy);
              float line = 1.0 - smoothstep(0.03, 0.13, abs(d - uRing.z));
              float fill = (1.0 - step(uRing.z, d)) * (0.1 + 0.08 * smoothstep(uRing.z * 0.55, uRing.z, d));
              totalEmissiveRadiance += uRingColor * (line * 1.25 + fill) * uRing.w;
            }
            if (uRing2.w > 0.001) {
              float d = length(vPWorld.xz - uRing2.xy);
              float line = 1.0 - smoothstep(0.03, 0.13, abs(d - uRing2.z));
              // A soft wave just behind the line (the bell's sound spreading), not a filled disc.
              float fill = smoothstep(uRing2.z - 1.6, uRing2.z, d) * (1.0 - step(uRing2.z, d)) * 0.16;
              totalEmissiveRadiance += uRing2Color * (line * 1.25 + fill) * uRing2.w;
            }
            float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 4.0);
            totalEmissiveRadiance += uRim * rimF * diffuseColor.rgb * 0.5;
            ${rich() ? 'totalEmissiveRadiance += lampLight(vPWorld, diffuseColor.rgb);' : ''}
          }
        `);
    };
    this.track(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  private buildWater() {
    const w = this.world;
    const b = this.biome;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG.replace('RICH_WATER', rich() ? RICH_WATER_GLSL : '')
        .replace('uniform float uTime, uLava, uFogDensity, uLevel, uMurk;', 'uniform float uTime, uLava, uFogDensity, uLevel, uMurk;\n  uniform vec3 uRipples[5];\n  uniform vec3 uBank, uInk;'),
      uniforms: this.waterU = {
        uBrush: shared.uBrush,
        uTime: shared.uTime,
        uField: { value: this.fieldTex },
        uExt: { value: new THREE.Vector2(w.extW, w.extH) },
        uShallow: { value: colorOf(b.waterShallow) },
        uDeep: { value: colorOf(b.waterDeep) },
        uSky: { value: colorOf(b.zenith).lerp(colorOf(b.horizon), 0.6) },
        uSun: { value: colorOf(b.sunColor) },
        uFog: { value: colorOf(b.fog) },
        uFoam: { value: colorOf(0xffffff).lerp(colorOf(b.horizon), 0.2) },
        uSunDir: { value: this.sunDir },
        uLava: { value: 0 },
        uFogDensity: { value: b.fogDensity },
        uLevel: { value: w.waterLevel },
        uMurk: this.murk,
        uRipples: { value: ripples(w) },
        uBank: { value: colorOf(b.groundA).multiplyScalar(0.55) },
        uInk: { value: new THREE.Color(0.05, 0.06, 0.07) },
      },
    });
    this.track(mat);
    this.waterFog = mat.uniforms.uFogDensity as THREE.IUniform<number>;
    const geo = this.track(new THREE.PlaneGeometry(w.extW * 2, w.extH * 2));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = w.waterLevel;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  private buildSky() {
    const b = this.biome;
    const mat = this.track(new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: SKY_FRAG,
      uniforms: this.skyU = {
        uZenith: { value: colorOf(b.zenith) },
        uHorizon: { value: colorOf(b.horizon) },
        uLow: { value: colorOf(b.low) },
        uSun: { value: colorOf(b.sunColor) },
        uCloud: { value: colorOf(b.cloudLit) },
        uSunDir: { value: this.sunDir },
        uBrush: shared.uBrush,
        uTime: shared.uTime,
        uAurora: { value: 0 },
        uStars: { value: b.stars },
      },
    }));
    const sky = new THREE.Mesh(this.track(new THREE.SphereGeometry(100, 32, 18)), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.scene.add(sky);

    // The sea of clouds the island floats in, as two parallax layers.
    const layer = (y: number, alpha: number, scale: number, speed: number) => {
      const m = this.track(new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: CLOUD_FRAG,
        uniforms: {
          uBrush: shared.uBrush,
          uTime: shared.uTime,
          uLit: { value: colorOf(b.cloudLit) },
          uShade: { value: colorOf(b.cloudShade) },
          uFade: { value: colorOf(b.low) },
          uSunDir: { value: this.sunDir },
          uAlpha: { value: alpha },
          uScale: { value: scale },
          uSpeed: { value: speed },
        },
      }));
      this.cloudU.push(m.uniforms);
      const g = this.track(new THREE.CircleGeometry(900, 48));
      g.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.y = y;
      mesh.frustumCulled = false;
      mesh.renderOrder = -5;
      this.scene.add(mesh);
    };
    layer(-30, 1, 1, 1);
    layer(-15, 0.5, 1.7, 1.8);
  }

  private instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: THREE.Matrix4[], colors?: THREE.Color[], shadow = true, ink: OutlineClass | null = 'nature') {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((m, i) => mesh.setMatrixAt(i, m));
    if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    if (shadow && ink) inked(mesh, ink);
    this.scene.add(mesh);
    this.disposables.push({ dispose: () => mesh.dispose() });
    return mesh;
  }

  private buildDecor() {
    const world = this.world;
    const groups = new Map<string, typeof world.blockers>();
    for (const b of world.blockers) {
      if (!groups.has(b.kind)) groups.set(b.kind, []);
      groups.get(b.kind)!.push(b);
    }
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const Y = new THREE.Vector3(0, 1, 0);
    const P = new THREE.Vector3();
    const S = new THREE.Vector3();
    for (const [kind, list] of groups) {
      const geo = decorGeo(kind);
      const mats: THREE.Matrix4[] = [];
      const cols: THREE.Color[] = [];
      for (const b of list) {
        const y = geo.floats ? world.waterLevel + 0.02 : world.height(b.x, b.z) - (geo.flat ? 0.02 : 0.08);
        Q.setFromAxisAngle(Y, b.rot);
        P.set(b.x, y, b.z);
        S.setScalar(b.scale);
        mats.push(M.compose(P, Q, S).clone());
        const t = geo.flat || geo.ink === 'building' ? 1 : 0.84 + b.tint * 0.32;
        cols.push(new THREE.Color(t, t * (0.95 + b.tint * 0.08), t * (0.9 + (1 - b.tint) * 0.14)));
      }
      const ink = geo.flat ? null : geo.ink ?? 'nature';
      const solid = this.instanced(geo.solid, Mats.std, mats, cols, !geo.floats, ink);
      if (geo.flat) solid.castShadow = false;
      if (geo.floats && rich()) this.floaters.push({ mesh: solid, base: mats.map((m) => m.clone()) });
      if (geo.leaf) this.instanced(geo.leaf, Mats.stdFoliage, mats, cols, true, ink ?? 'nature');
      if (geo.glow) this.instanced(geo.glow, Mats.glow, mats, undefined, false);
    }
  }

  private buildGrass() {
    const world = this.world;
    const b = this.biome;
    const inkGround = true;
    const area = (world.extW * world.extH) / LANTERNFALL_AREA;
    const budget = Math.floor(Math.min(this.q.grass, 1500) * look().ground.grass * b.grassDensity * Math.max(area, 0.35));
    const rng = makeRng(world.seed + 5);
    if (budget > 0) {
      const blades = new MB();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const r = 0.09;
        const h = 0.42 + (i % 3) * 0.13;
        const geo = new THREE.BufferGeometry();
        const w = 0.075;
        const c = Math.cos(a), s = Math.sin(a);
        const lean = 0.18;
        const v = [
          -w * s, 0, w * c, w * s, 0, -w * c, -w * 0.62 * s + c * lean * 0.4, h * 0.55, w * 0.62 * c + s * lean * 0.4,
          w * s, 0, -w * c, w * 0.62 * s + c * lean * 0.4, h * 0.55, -w * 0.62 * c + s * lean * 0.4, -w * 0.62 * s + c * lean * 0.4, h * 0.55, w * 0.62 * c + s * lean * 0.4,
          -w * 0.62 * s + c * lean * 0.4, h * 0.55, w * 0.62 * c + s * lean * 0.4, w * 0.62 * s + c * lean * 0.4, h * 0.55, -w * 0.62 * c + s * lean * 0.4, c * lean, h, s * lean,
        ];
        geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        // Upward normals light the blades like the ground beneath them, so they blend softly.
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(Array(v.length / 3).fill([0, 1, 0]).flat(), 3));
        blades.add(geo, [inkGround ? 0xc4c4c4 : 0x8a8a8a, 0xffffff], { p: [Math.cos(a) * r, 0, Math.sin(a) * r] });
      }
      const geo = blades.build();
      this.track(geo);
      const mat = this.track(paint(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { wind: 0.28, brush: 0.5 }));
      const mesh = new THREE.InstancedMesh(geo, mat, budget);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const y = new THREE.Vector3(0, 1, 0);
      const p = new THREE.Vector3();
      const s = new THREE.Vector3();
      const c = new THREE.Color();
      const a = colorOf(b.grass[0]).multiplyScalar(look().ground.grassLight);
      const bb = colorOf(b.grass[1]).multiplyScalar(look().ground.grassLight);
      let placed = 0;
      for (let t = 0; t < budget * 3 && placed < budget; t++) {
        const inner = rng() < 0.82;
        const rangeX = inner ? world.halfW + 2 : world.extW;
        const rangeZ = inner ? world.halfH + 2 : world.extH;
        const x = (rng() * 2 - 1) * rangeX;
        const z = (rng() * 2 - 1) * rangeZ;
        const rd = world.roadDistance(x, z);
        if (rd < world.pathWidth * 0.5 + 0.2) continue;
        const h = world.height(x, z);
        if (world.hasWater && h < world.waterLevel + 0.15) continue;
        if (world.islandMask(x, z) < 0.09) continue;
        if (Math.abs(world.height(x + 0.8, z) - h) + Math.abs(world.height(x, z + 0.8) - h) > 0.8) continue;
        const n = fbm(x * 0.1, z * 0.1, world.seed + 31, 3);
        if (inkGround ? n < 0.53 : rng() > smoothstep(0.25, 0.5, n) + 0.12) continue;
        q.setFromAxisAngle(y, rng() * 6.28);
        const sc = (0.55 + rng() * 0.62) * (0.75 + n * 0.8) * (inkGround ? 1.05 : 1);
        s.set(sc, sc * (0.8 + rng() * 0.7), sc);
        p.set(x, h - 0.03, z);
        mesh.setMatrixAt(placed, m.compose(p, q, s));
        c.copy(a).lerp(bb, clamp(n * 1.3 - 0.1 + (rng() - 0.5) * 0.3));
        mesh.setColorAt(placed, c);
        placed++;
      }
      mesh.count = placed;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.disposables.push({ dispose: () => mesh.dispose() });
    }

    // Flowers, in drifts.
    const flowerCount = Math.floor(Math.min(1400, this.q.grass * 0.05 + 240) * Math.min(1, b.grassDensity + 0.25) * Math.max(area, 0.35) * (b.flowerDensity ?? 1));
    const fb = new MB();
    fb.cyl(0.012, 0.016, 0.34, 0x4f7a32, { p: [0, 0.17, 0] }, 4);
    const fbHead = new MB();
    fbHead.sphere(0.075, 0xffffff, { p: [0, 0.36, 0], s: [1, 0.55, 1] }, 6, 4);
    const stem = this.track(fb.build()); const head = this.track(fbHead.build());
    this.track(stem); this.track(head);
    const stems: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const M = new THREE.Matrix4();
    for (let t = 0; t < flowerCount * 6 && stems.length < flowerCount; t++) {
      const x = (rng() * 2 - 1) * (world.halfW + 6);
      const z = (rng() * 2 - 1) * (world.halfH + 6);
      if (world.roadDistance(x, z) < world.pathWidth * 0.5 + 0.3) continue;
      const h = world.height(x, z);
      if (world.hasWater && h < world.waterLevel + 0.25) continue;
      if (fbm(x * 0.16, z * 0.16, world.seed + 61, 2) < 0.56) continue;
      const sc = 0.8 + rng() * 0.7;
      M.makeScale(sc, sc, sc).setPosition(x, h, z);
      stems.push(M.clone());
      cols.push(colorOf(b.flowers[Math.floor(rng() * b.flowers.length)]));
    }
    if (stems.length) {
      this.instanced(stem, Mats.std, stems, undefined, false);
      this.instanced(head, Mats.std, stems, cols, false);
    }

    {
      // Lily pads on quiet water.
      const pad = new MB();
      pad.cyl(0.42, 0.42, 0.03, [0x2f6d3c, 0x5ea552], {}, 10);
      const padGeo = this.track(pad.build());
      const flower = new MB();
      flower.cone(0.11, 0.17, [0xfff2f7, 0xff9fc0], { p: [0.1, 0.08, 0.05] }, 6);
      const flowerGeo = this.track(flower.build());
      const pads: THREE.Matrix4[] = [];
      const fl: THREE.Matrix4[] = [];
      for (let t = 0; t < 3000 && pads.length < 220; t++) {
        const x = (rng() * 2 - 1) * world.extW * 0.95;
        const z = (rng() * 2 - 1) * world.extH * 0.95;
        const h = world.height(x, z);
        if (h > world.waterLevel - 0.12 || h < world.waterLevel - 1.4) continue;
        if (world.islandMask(x, z) < 0.12) continue;
        const sc = 0.65 + rng() * 1.1;
        M.makeRotationY(rng() * 6.28).scale(new THREE.Vector3(sc, 1, sc)).setPosition(x, world.waterLevel + 0.03, z);
        pads.push(M.clone());
        if (rng() < 0.22) fl.push(M.clone());
      }
      if (pads.length) {
        const pm = this.instanced(padGeo, Mats.std, pads, undefined, false);
        if (rich()) this.floaters.push({ mesh: pm, base: pads.map((m) => m.clone()) });
      }
      if (fl.length) {
        const fm = this.instanced(flowerGeo, Mats.std, fl, undefined, false);
        if (rich()) this.floaters.push({ mesh: fm, base: fl.map((m) => m.clone()) });
      }
    }
  }

  private buildRoadside() {
    const world = this.world;
    const b = this.biome;
    const rng = makeRng(world.seed + 91);
    const stone = new MB();
    if (fine()) stoneShape(stone, 0.3, [colorOf(b.rockA).getHex(), colorOf(b.rockB).getHex()], { s: [1, 0.62, 1], wobble: 0.04 });
    else stone.ico(0.3, [colorOf(b.rockA).getHex(), colorOf(b.rockB).getHex()], { s: [1, 0.7, 1], wobble: 0.04 }, 0);
    const stoneGeo = this.track(stone.build({ ground: true, groundY: -0.12 }));
    const list: THREE.Matrix4[] = [];
    const M = new THREE.Matrix4();
    const tmp = { x: 0, z: 0, dx: 0, dz: 0 };
    const v = new THREE.Vector3();
    for (const road of world.roads) {
      for (let d = 0; d < road.length; d += 0.9) {
        if (rng() < 0.62) continue;
        road.sample(d, tmp);
        const side = rng() < 0.5 ? -1 : 1;
        const off = world.pathWidth * 0.5 + 0.3 + rng() * 0.5;
        const x = tmp.x - tmp.dz * off * side;
        const z = tmp.z + tmp.dx * off * side;
        if (world.roadDistance(x, z) < world.pathWidth * 0.5 + 0.1) continue;
        const sc = 0.5 + rng() * 1;
        M.makeRotationY(rng() * 6.28).scale(v.set(sc, sc * (0.7 + rng() * 0.6), sc)).setPosition(x, world.height(x, z) + 0.02, z);
        list.push(M.clone());
      }
    }
    if (list.length) this.instanced(stoneGeo, Mats.std, list);
  }

  /**
   * Painted+: rounded stones laid around the pond's shoreline (the reference's stone-edged pond), some
   * with moss. They sit at the water line, just past where the caretaker can walk, so they never block.
   */
  private buildPondEdge() {
    const world = this.world;
    const b = this.biome;
    const pond = world.place.pond;
    const rng = makeRng(world.seed + 131);
    const rockA = colorOf(b.rockA).lerp(colorOf(0xa8a598), 0.4).getHex();
    const rockB = colorOf(b.rockB).lerp(colorOf(0xd2cebf), 0.3).getHex();
    const sm = new MB();
    stoneShape(sm, 0.5, [rockA, rockB], { s: [1.25, 0.5, 0.85], wobble: 0.06, wobbleFreq: 1.4 });
    const stoneGeo = this.track(sm.build({ ground: true, groundY: -0.16 }));
    const mm = new MB();
    mm.ico(0.42, [0x5f7f3f, 0x9bb866], { p: [-0.08, 0.17, 0.03], s: [1.15, 0.28, 0.85], flat: false, smooth: true, puff: 0.35 }, 2);
    const mossGeo = this.track(mm.build());
    const stones: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const mossy: THREE.Matrix4[] = [];
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const shoreAt = (a: number): number | null => {
      // Walk outward from the pond's middle to where the ground first rises just past the water line.
      for (let r = pond.r * 0.3; r < pond.r * 1.8; r += 0.05) {
        if (world.height(pond.x + Math.cos(a) * r, pond.z + Math.sin(a) * r) > world.waterLevel + 0.06) return r;
      }
      return null;
    };
    const solids = world.solids;
    let a = 0;
    while (a < Math.PI * 2) {
      const r = shoreAt(a);
      const size = 0.55 + rng() * 0.4;
      if (r !== null) {
        const x = pond.x + Math.cos(a) * (r + 0.05), z = pond.z + Math.sin(a) * (r + 0.05);
        const clearOfPath = world.roadDistance(x, z) > world.pathWidth * 0.5 + 0.35;
        const clearOfProps = solids.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + 0.4);
        if (clearOfPath && clearOfProps) {
          // Long side along the shore.
          Q.setFromAxisAngle(Y, -a + Math.PI / 2 + (rng() - 0.5) * 0.35);
          P.set(x, world.waterLevel + 0.02, z);
          S.set(size, size * (0.8 + rng() * 0.5), size);
          M.compose(P, Q, S);
          stones.push(M.clone());
          const t = 0.88 + rng() * 0.22;
          cols.push(new THREE.Color(t, t * 0.99, t * (0.95 + rng() * 0.06)));
          if (rng() < 0.35) mossy.push(M.clone());
        }
      }
      // Next stone: step along the shore by about this stone's length.
      a += (size * 0.95) / Math.max(1, r ?? pond.r);
    }
    if (stones.length) {
      this.instanced(stoneGeo, Mats.std, stones, cols, true, 'nature');
      if (mossy.length) this.instanced(mossGeo, Mats.std, mossy, undefined, false);
    }
  }

  private buildIslets() {
    const world = this.world;
    const b = this.biome;
    const rng = makeRng(world.seed + 17);
    const kinds = ['oak', 'pine', 'birch'];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.4;
      const r = 1.08 + rng() * 0.5;
      const x = Math.cos(a) * world.extW * r * 1.15;
      const z = Math.sin(a) * world.extH * r * 1.2;
      const size = 3 + rng() * 6;
      const y = -8 + rng() * 11;
      const m = new MB();
      m.cone(size, size * 1.75, [colorOf(b.rockA).getHex(), colorOf(b.rockB).getHex()], { p: [0, -size * 0.86, 0], r: [Math.PI, 0, 0], wobble: size * 0.13, wobbleFreq: 0.4 }, 9, 4);
      m.cyl(size * 1.03, size * 0.98, size * 0.16, [colorOf(b.groundA).getHex(), colorOf(b.groundB).getHex()], { p: [0, size * 0.06, 0], wobble: size * 0.03, wobbleFreq: 0.7 }, 10);
      const geo = this.track(m.build());
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(geo, Mats.std);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const count = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const d = decorGeo(kinds[Math.floor(rng() * kinds.length)]);
        const place = (geom: THREE.BufferGeometry, mat: THREE.Material) => {
          const t = new THREE.Mesh(geom, mat);
          const ang = k * 2.2 + 0.5;
          t.position.set(Math.cos(ang) * size * 0.45, size * 0.12, Math.sin(ang) * size * 0.45);
          t.scale.setScalar(0.7 + (k % 2) * 0.3);
          t.castShadow = true;
          group.add(t);
        };
        place(d.solid, Mats.std);
        if (d.leaf) place(d.leaf, Mats.stdFoliage);
        if (d.glow) place(d.glow, Mats.glow);
      }
      group.position.set(x, y, z);
      this.scene.add(group);
      this.islets.push({ obj: group, y, phase: rng() * 6.28 });
    }
  }

  private buildRays(sunDir: THREE.Vector3) {
    const b = this.biome;
    const rng = makeRng(this.world.seed + 40);
    const geo = this.track(new THREE.PlaneGeometry(1, 1));
    const up = sunDir.clone();
    for (let i = 0; i < b.rays; i++) {
      const mat = this.track(new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
        // Fades shafts that turn edge-on to the camera, where they would collapse into hard lines.
        vertexShader: `varying vec2 vUv; varying float vFace; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vFace = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: RAY_FRAG,
        uniforms: { uColor: { value: colorOf(b.rayColor) }, uTime: shared.uTime, uSeed: { value: rng() } },
      }));
      const mesh = new THREE.Mesh(geo, mat);
      const width = 6 + rng() * 13;
      const len = 95;
      const px = (rng() * 2 - 1) * this.world.halfW * 1.1;
      const pz = (rng() * 2 - 1) * this.world.halfH * 1.1;
      const right = new THREE.Vector3(1, 0, 0.2 + rng()).normalize();
      const normal = new THREE.Vector3().crossVectors(right, up).normalize();
      const r2 = new THREE.Vector3().crossVectors(up, normal).normalize();
      const basis = new THREE.Matrix4().makeBasis(r2, up, normal);
      mesh.quaternion.setFromRotationMatrix(basis);
      mesh.scale.set(width, len, 1);
      mesh.position.set(px, 2, pz).addScaledVector(up, len * 0.44);
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      this.scene.add(mesh);
    }
  }

  private buildAmbient(pixelRatio: number) {
    // Two layers that cross-fade with the time of day: pollen by day, fireflies at night.
    const world = this.world;
    type Cfg = { n: number; vel: [number, number, number]; wobble: number; pulse: number; size: number; color: number; gain: number; alpha: number; h: number; additive: boolean };
    const fall = this.season.fall;
    const cfgs: Record<'pollen' | 'fireflies' | 'fall', Cfg> = {
      pollen: { n: 120, vel: [0.35, 0.03, 0.14], wobble: 1.4, pulse: 0, size: 1.9, color: 0xffeeb8, gain: 1.5, alpha: 0.7, h: 10, additive: true },
      fireflies: { n: 260, vel: [0.1, 0.04, 0.06], wobble: 2.6, pulse: 1.4, size: 3.4, color: 0xd8ff9c, gain: 3.4, alpha: 0.95, h: 5, additive: true },
      // Phase 5: the season's falling things (petals, leaves, snow), drifting down and across.
      fall: { n: Math.round(340 * fall.amount), vel: [0.25 * fall.speed, -1.4 * fall.speed, 0.12 * fall.speed], wobble: 1.1, pulse: 0, size: fall.size, color: fall.color, gain: 1, alpha: 0.9, h: 14, additive: false },
    };
    (fall.amount > 0 ? ['pollen', 'fireflies', 'fall'] as const : ['pollen', 'fireflies'] as const).forEach((key, li) => {
      const c = cfgs[key];
      const rng = makeRng(world.seed + 3 + li * 101);
      const n = Math.floor(c.n * look().ambient * this.q.ambient * Math.max((world.extW * world.extH) / LANTERNFALL_AREA, 0.4));
      const box = new THREE.Vector3(world.extW * 0.92, c.h / 2, world.extH * 0.92);
      const pos = new Float32Array(n * 3);
      const seed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (rng() * 2 - 1) * box.x;
        pos[i * 3 + 1] = (rng() * 2 - 1) * box.y;
        pos[i * 3 + 2] = (rng() * 2 - 1) * box.z;
        for (let k = 0; k < 4; k++) seed[i * 4 + k] = rng();
      }
      const geo = this.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
      const mat = this.track(new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: c.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        fog: false,
        vertexShader: AMBIENT_VERT,
        fragmentShader: AMBIENT_FRAG,
        uniforms: {
          uTime: shared.uTime,
          uScale: { value: window.innerHeight * pixelRatio * 0.5 },
          uSize: { value: c.size },
          uPulse: { value: c.pulse },
          uWobble: { value: c.wobble },
          uVel: { value: new THREE.Vector3(...c.vel) },
          uBox: { value: box },
          uColor: { value: colorOf(c.color).multiplyScalar(c.gain) },
          uAlpha: { value: c.alpha },
        },
      }));
      this.ambientMats.push({ mat, key, alpha: c.alpha });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 8;
      this.scene.add(pts);
    });
  }

  private murk = { value: 0 };
  private heal = { value: 1 };
  /** How restored the ground looks (0 neglected .. 1 restored): eased by the caller. */
  setHeal(v: number) {
    this.heal.value = v;
  }
  /** How murky the pond is (0 clear .. 1), from the place's restoration (sim/progress.ts waterMurk). */
  setWaterMurk(v: number) {
    this.murk.value = v;
  }

  /** Fog density for the whole scene (the mist response, plan 3.4 changes it as the place heals). */
  setFogDensity(d: number) {
    (this.scene.fog as THREE.FogExp2).density = d;
    for (const a of this.ambientMats) a.mat.visible = (a.mat.uniforms.uAlpha!.value as number) > 0.01;
    if (this.waterFog) this.waterFog.value = d;
  }

  update(time: number) {
    for (const i of this.islets) {
      i.obj.position.y = i.y + Math.sin(time * 0.3 + i.phase) * 0.9;
    }
    if (this.life) {
      this.life.update(time, smoothstep(0.75, 0.95, shared.uLight.value));
      // Lotus and lily pads ride a slow swell.
      for (const fl of this.floaters) {
        fl.base.forEach((b, i) => {
          this.bobP.setFromMatrixPosition(b);
          const ph = this.bobP.x * 0.7 + this.bobP.z * 0.9;
          this.bobM.makeRotationY(Math.sin(time * 0.3 + ph) * 0.06).premultiply(this.bobT.makeTranslation(0, Math.sin(time * 0.9 + ph) * 0.012, 0));
          fl.mesh.setMatrixAt(i, this.bobM2.multiplyMatrices(b, this.bobM));
        });
        fl.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // --- Lanternfall+ (rich detail): ground dressing, life, lantern light.
  private life: Life | null = null;
  private floaters: { mesh: THREE.InstancedMesh; base: THREE.Matrix4[] }[] = [];
  private bobP = new THREE.Vector3();
  private bobM = new THREE.Matrix4();
  private bobM2 = new THREE.Matrix4();
  private bobT = new THREE.Matrix4();
  /** How many of the shared lantern-light slots the stone lanterns use; buildings fill the rest. */
  lampCount = 0;

  private buildRich() {
    const b = this.biome;
    const plan = dressingPlan(this.world);
    const geos = dressingGeos([colorOf(b.rockA).getHex(), colorOf(b.rockB).getHex()]);
    for (const k of DRESS_KINDS) {
      const list = plan[k];
      if (!list.mats.length) continue;
      const g = geos[k];
      this.track(g.geo);
      const mesh = this.instanced(g.geo, Mats.std, list.mats, list.tints.map((t) => new THREE.Color(t, t, t)), g.shadow, g.ink);
      mesh.castShadow = g.shadow;
    }
    this.life = new Life(this.world, this.season.snow > 0.3 ? null : this.season.drift, this.season.butterflies);
    this.scene.add(this.life.group);
    this.disposables.push(this.life);
    const lamps = staticLamps(this.world).slice(0, LAMPS);
    lamps.forEach((l, i) => shared.uLamps.value[i]!.copy(l));
    for (let i = lamps.length; i < LAMPS; i++) shared.uLamps.value[i]!.set(0, 0, 0, 0);
    this.lampCount = lamps.length;
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Light && (o as THREE.DirectionalLight).shadow?.map) (o as THREE.DirectionalLight).shadow.map!.dispose();
      if (o instanceof THREE.InstancedMesh) o.dispose();
      // Freeing GPU buffers is safe for cached models too, since they upload again the next time they are drawn.
      (o as THREE.Mesh).geometry?.dispose();
    });
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
