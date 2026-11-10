// Copied from Lanternfall (games/lanternfall/src/render/vfx.ts @ b282628): the GPU particle system and
// shockwave rings, unchanged. Ribbons and health bars (tower defense only) were left out.
// GPU particle system and shockwave rings.
import * as THREE from 'three';

const PARTICLE_VERT = /* glsl */ `
  attribute vec3 aVel;
  attribute vec4 aTime; // birth, life, sizeStart, sizeEnd
  attribute vec4 aColor;
  attribute vec2 aMotion; // gravity, drag
  uniform float uNow, uScale;
  varying vec4 vC;
  void main() {
    float t = uNow - aTime.x;
    float k = t / aTime.y;
    if (k < 0.0 || k > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vC = vec4(0.0); return; }
    float drag = aMotion.y > 0.0 ? (1.0 - exp(-aMotion.y * t)) / aMotion.y : t;
    vec3 p = position + aVel * drag + vec3(0.0, -aMotion.x * t * t * 0.5, 0.0);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_PointSize = mix(aTime.z, aTime.w, k) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
    vC = aColor;
    vC.a *= smoothstep(0.0, 0.08, k) * (1.0 - k * k);
  }
`;
const PARTICLE_FRAG = /* glsl */ `
  uniform float uSoft;
  varying vec4 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, uSoft);
    gl_FragColor = vec4(vC.rgb, vC.a * a);
  }
`;

export interface EmitOpts {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  life: number;
  size: number;
  sizeEnd?: number;
  color: THREE.Color;
  alpha?: number;
  gravity?: number;
  drag?: number;
}

const STRIDE = 16;

export class Particles {
  mesh: THREE.Points;
  private data: Float32Array;
  private buffer: THREE.InterleavedBuffer;
  private head = 0;
  private dirtyFrom = -1;
  private dirtyTo = -1;
  private wrapped = false;
  mat: THREE.ShaderMaterial;
  now = 0;

  constructor(public capacity: number, additive: boolean, soft = 1.6) {
    this.data = new Float32Array(capacity * STRIDE);
    this.buffer = new THREE.InterleavedBuffer(this.data, STRIDE);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.InterleavedBufferAttribute(this.buffer, 3, 0));
    geo.setAttribute('aVel', new THREE.InterleavedBufferAttribute(this.buffer, 3, 3));
    geo.setAttribute('aTime', new THREE.InterleavedBufferAttribute(this.buffer, 4, 6));
    geo.setAttribute('aColor', new THREE.InterleavedBufferAttribute(this.buffer, 4, 10));
    geo.setAttribute('aMotion', new THREE.InterleavedBufferAttribute(this.buffer, 2, 14));
    // Particles start "dead" until they are written.
    for (let i = 0; i < capacity; i++) this.data[i * STRIDE + 6] = -1e6;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uNow: { value: 0 }, uScale: { value: 500 }, uSoft: { value: soft } },
    });
    this.mesh = new THREE.Points(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  emit(o: EmitOpts) {
    const i = this.head;
    const d = this.data;
    const k = i * STRIDE;
    d[k] = o.x; d[k + 1] = o.y; d[k + 2] = o.z;
    d[k + 3] = o.vx ?? 0; d[k + 4] = o.vy ?? 0; d[k + 5] = o.vz ?? 0;
    d[k + 6] = this.now; d[k + 7] = o.life; d[k + 8] = o.size; d[k + 9] = o.sizeEnd ?? o.size;
    d[k + 10] = o.color.r; d[k + 11] = o.color.g; d[k + 12] = o.color.b; d[k + 13] = o.alpha ?? 1;
    d[k + 14] = o.gravity ?? 0; d[k + 15] = o.drag ?? 0;
    if (this.dirtyFrom < 0) { this.dirtyFrom = i; this.dirtyTo = i; }
    else if (i < this.dirtyFrom) { this.wrapped = true; }
    else this.dirtyTo = Math.max(this.dirtyTo, i);
    this.head = (i + 1) % this.capacity;
  }

  update(now: number, scale: number) {
    this.now = now;
    this.mat.uniforms.uNow.value = now;
    this.mat.uniforms.uScale.value = scale;
    if (this.dirtyFrom >= 0) {
      this.buffer.clearUpdateRanges();
      if (!this.wrapped) this.buffer.addUpdateRange(this.dirtyFrom * STRIDE, (this.dirtyTo - this.dirtyFrom + 1) * STRIDE);
      this.buffer.needsUpdate = true;
      this.dirtyFrom = this.dirtyTo = -1;
      this.wrapped = false;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

const RING_VERT = /* glsl */ `
  attribute vec4 aParams; // birth, life, radius, thickness
  attribute vec3 aRingColor;
  uniform float uNow;
  varying vec2 vP; varying float vK; varying vec3 vC; varying float vT;
  void main() {
    float k = (uNow - aParams.x) / aParams.y;
    vK = k;
    vC = aRingColor;
    vT = aParams.w;
    vP = position.xz * 2.0;
    float grow = 1.0 - pow(1.0 - clamp(k, 0.0, 1.0), 2.4);
    vec3 p = position * aParams.z * 2.0 * grow;
    if (k < 0.0 || k > 1.0) p = vec3(0.0);
    vec4 w = instanceMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const RING_FRAG = /* glsl */ `
  varying vec2 vP; varying float vK; varying vec3 vC; varying float vT;
  void main() {
    float r = length(vP);
    if (r > 1.0) discard;
    float th = vT * (1.0 - vK * 0.5);
    float band = smoothstep(1.0 - th, 1.0 - th * 0.25, r) * (1.0 - smoothstep(0.965, 1.0, r));
    float inner = (1.0 - r) * 0.1;
    gl_FragColor = vec4(vC, (band + inner) * (1.0 - vK) * (1.0 - vK));
  }
`;

export class Rings {
  mesh: THREE.InstancedMesh;
  private params: THREE.InstancedBufferAttribute;
  private colors: THREE.InstancedBufferAttribute;
  private head = 0;
  private m = new THREE.Matrix4();
  private mat: THREE.ShaderMaterial;
  now = 0;

  constructor(private capacity = 96) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.params = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4).fill(-100), 4);
    this.colors = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.params.setUsage(THREE.DynamicDrawUsage);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aParams', this.params);
    geo.setAttribute('aRingColor', this.colors);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uNow: { value: 0 } },
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
  }

  add(x: number, y: number, z: number, radius: number, color: THREE.Color, life = 0.55, thickness = 0.22) {
    const i = this.head;
    this.head = (i + 1) % this.capacity;
    this.params.setXYZW(i, this.now, life, radius, thickness);
    this.colors.setXYZ(i, color.r, color.g, color.b);
    this.m.makeTranslation(x, y, z);
    this.mesh.setMatrixAt(i, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.params.needsUpdate = true;
    this.colors.needsUpdate = true;
  }

  update(now: number) {
    this.now = now;
    this.mat.uniforms.uNow.value = now;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.mesh.dispose();
  }
}

