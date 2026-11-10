// Baked ambient occlusion for models built in code (Painted+ look, owner request 2026-11-10).
// Soft darkening where parts meet each other and the ground (a post into a deck, tiles under a ridge,
// puffs of a tree crown, a stone's foot) is what makes a model read as a solid object sitting in the
// world. It is computed once when a model is built and multiplied into its vertex colors, so it costs
// nothing per frame: no extra pass, no extra texture, the same draw calls on a phone.
//
// How: the model's surfaces are marked into a coarse voxel grid (about 44 cells along its longest side),
// then each vertex sends a few short rays over the hemisphere around its normal; the share of rays that
// hit a marked cell (or the ground plane, if asked) is its occlusion. Shadows are tinted warm, never grey.
import * as THREE from 'three';

export interface AOOptions {
  /** Skip the bake (glowing pieces, which should stay evenly lit). */
  off?: boolean;
  /** Treat y = groundY as solid ground (models whose origin sits on the terrain). */
  ground?: boolean;
  groundY?: number;
  /** Other geometry that shades this one (e.g. a building's deck under its posts), in the same space. */
  occluders?: THREE.BufferGeometry[];
}

/** Hemisphere directions in a local frame (z = up along the normal), roughly cosine-spread. */
const DIRS: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    // Golden-angle spiral; elevation kept above ~14° so rays don't graze the surface they start from.
    const t = (i + 0.5) / n;
    const z = 0.25 + 0.75 * Math.sqrt(1 - t);
    const r = Math.sqrt(1 - z * z);
    const a = i * 2.39996;
    out.push([Math.cos(a) * r, Math.sin(a) * r, z]);
  }
  return out;
})();

/**
 * Multiplies occlusion into `g`'s vertex colors. `strength` 0 leaves it unchanged, 1 lets a fully
 * enclosed corner fall to about 35% brightness.
 */
export function bakeAO(g: THREE.BufferGeometry, strength: number, o: AOOptions = {}): void {
  const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const col = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!pos || !nrm || !col || strength <= 0 || o.off || pos.count === 0) return;
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.05);
  const cell = Math.max(0.025, maxDim / 44);
  const reach = cell * 7;
  const x0 = bb.min.x - reach - cell, y0 = bb.min.y - reach - cell, z0 = bb.min.z - reach - cell;
  const nx = Math.ceil((size.x + 2 * reach) / cell) + 3;
  const ny = Math.ceil((size.y + 2 * reach) / cell) + 3;
  const nz = Math.ceil((size.z + 2 * reach) / cell) + 3;
  const grid = new Uint8Array(nx * ny * nz);
  const voxelize = (geo: THREE.BufferGeometry) => {
    const pa = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pa.array as ArrayLike<number>;
    const idx = geo.index ? (geo.index.array as ArrayLike<number>) : null;
    const count = idx ? idx.length : pa.count;
    const inv = 1 / cell;
    // Samples a little under a cell apart: dense enough that the short rays can't slip through.
    const spacing = cell * 0.85;
    for (let t = 0; t + 2 < count; t += 3) {
      const a = (idx ? idx[t]! : t) * 3, b = (idx ? idx[t + 1]! : t + 1) * 3, c = (idx ? idx[t + 2]! : t + 2) * 3;
      const ax = arr[a]!, ay = arr[a + 1]!, az = arr[a + 2]!;
      const ux = arr[b]! - ax, uy = arr[b + 1]! - ay, uz = arr[b + 2]! - az;
      const vx = arr[c]! - ax, vy = arr[c + 1]! - ay, vz = arr[c + 2]! - az;
      const e = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(vx - ux, vy - uy, vz - uz));
      const n = Math.min(120, Math.max(1, Math.ceil(e / spacing)));
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n - i; j++) {
          const u = i / n, v = j / n;
          const gi = Math.floor((ax + ux * u + vx * v - x0) * inv);
          const gj = Math.floor((ay + uy * u + vy * v - y0) * inv);
          const gk = Math.floor((az + uz * u + vz * v - z0) * inv);
          if (gi < 0 || gj < 0 || gk < 0 || gi >= nx || gj >= ny || gk >= nz) continue;
          grid[(gk * ny + gj) * nx + gi] = 1;
        }
      }
    }
  };
  voxelize(g);
  for (const oc of o.occluders ?? []) voxelize(oc);
  const ground = !!o.ground;
  const gy = o.groundY ?? 0;
  const inv = 1 / cell;
  const step = cell * 0.8;
  const t0 = cell * 1.8;
  const steps = Math.floor(reach / step);
  const pa = pos.array as ArrayLike<number>, na = nrm.array as ArrayLike<number>;
  // Merged models repeat each corner for every triangle that uses it: shade each corner once
  // (a numeric hash of position and normal; a rare collision only borrows a neighbour's shade).
  const done = new Map<number, number>();
  for (let v = 0; v < pos.count; v++) {
    const ox = pa[v * 3]!, oy = pa[v * 3 + 1]!, oz = pa[v * 3 + 2]!;
    let nx0 = na[v * 3]!, ny0 = na[v * 3 + 1]!, nz0 = na[v * 3 + 2]!;
    const key = (Math.round(ox * 400) * 73856093) ^ (Math.round(oy * 400) * 19349663) ^ (Math.round(oz * 400) * 83492791)
      ^ (Math.round(nx0 * 20) * 2654435761) ^ (Math.round(ny0 * 20) * 40503) ^ (Math.round(nz0 * 20) * 97);
    let shade = done.get(key);
    if (shade === undefined) {
      const nl = Math.hypot(nx0, ny0, nz0);
      if (nl < 1e-4) continue;
      nx0 /= nl; ny0 /= nl; nz0 /= nl;
      // A frame around the normal.
      let tx = Math.abs(ny0) < 0.9 ? -nz0 : 0, ty = 0, tz = Math.abs(ny0) < 0.9 ? nx0 : -nz0;
      if (Math.abs(ny0) >= 0.9) { tx = 0; ty = nz0; tz = -ny0; }
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      const bx = ny0 * tz - nz0 * ty, by = nz0 * tx - nx0 * tz, bz = nx0 * ty - ny0 * tx;
      const px = ox + nx0 * t0, py = oy + ny0 * t0, pz = oz + nz0 * t0;
      let occ = 0, wsum = 0;
      for (const [a, b, c] of DIRS) {
        const dx = tx * a + bx * b + nx0 * c;
        const dy = ty * a + by * b + ny0 * c;
        const dz = tz * a + bz * b + nz0 * c;
        wsum += c;
        for (let s = 0; s <= steps; s++) {
          const t = s * step;
          const y = py + dy * t;
          if (ground && y < gy) { occ += c * (1 - 0.55 * (t / reach)); break; }
          const gi = Math.floor((px + dx * t - x0) * inv), gj = Math.floor((y - y0) * inv), gk = Math.floor((pz + dz * t - z0) * inv);
          if (gi < 0 || gj < 0 || gk < 0 || gi >= nx || gj >= ny || gk >= nz) break;
          if (grid[(gk * ny + gj) * nx + gi] === 1) {
            // Near hits shade more than far ones.
            occ += c * (1 - 0.55 * (t / reach));
            break;
          }
        }
      }
      const k = Math.min(1, occ / wsum);
      shade = 1 - strength * 0.65 * Math.pow(k, 0.85);
      done.set(key, shade);
    }
    // Warm occlusion: blue falls off a little faster than red, like the painted reference's shadows.
    col.setXYZ(v, col.getX(v) * Math.pow(shade, 0.85), col.getY(v) * shade, col.getZ(v) * Math.pow(shade, 1.12));
  }
  col.needsUpdate = true;
}
