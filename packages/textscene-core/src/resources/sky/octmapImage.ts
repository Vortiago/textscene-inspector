/**
 * A square octmap of linear RGB in memory, and the filtered reads Godot's samplers make of it. The
 * reads allocate nothing, as the sky's ambient runs them for every texel of a downsample chain.
 */

/**
 * Bound once, not read from `Math` per call: a global lookup inside a VM context, where the
 * vitest pool runs this, costs about 100 times a local one, in a loop that runs a million times.
 */
const { floor, max, min } = Math;

export interface Octmap {
  size: number;
  /** RGB, row by row. */
  rgb: Float32Array;
}

export function blankOctmap(size: number): Octmap {
  return { size, rgb: new Float32Array(size * size * 3) };
}

/**
 * Adds a trilinear read of `mips` at `lod`, times `weight`, to `out`. The lod clamps to the mips
 * there are, as the GPU clamps it.
 */
export function addTrilinear(
  mips: readonly Octmap[],
  u: number,
  v: number,
  lod: number,
  weight: number,
  out: Float32Array
): void {
  const clamped = min(max(lod, 0), mips.length - 1);
  const lower = floor(clamped);
  const blend = clamped - lower;
  addBilinear(mips[lower]!, u, v, weight * (1 - blend), out, 0);
  if (blend > 0) addBilinear(mips[lower + 1]!, u, v, weight * blend, out, 0);
}

/**
 * Adds a bilinear read at `u`, `v` in 0..1, times `weight`, to `out` at `at`. It clamps to the edge,
 * as Godot's samplers for the sky's octmaps do (`copy_effects.cpp:1155`, `:1366`).
 */
export function addBilinear(
  { size, rgb }: Octmap,
  u: number,
  v: number,
  weight: number,
  out: Float32Array,
  at: number
): void {
  const fx = u * size - 0.5;
  const fy = v * size - 0.5;
  const x0 = floor(fx);
  const y0 = floor(fy);
  const ax = fx - x0;
  const ay = fy - y0;
  const left = min(max(x0, 0), size - 1);
  const right = min(max(x0 + 1, 0), size - 1);
  const top = min(max(y0, 0), size - 1) * size;
  const bottom = min(max(y0 + 1, 0), size - 1) * size;
  const a = (top + left) * 3;
  const b = (top + right) * 3;
  const c = (bottom + left) * 3;
  const d = (bottom + right) * 3;
  const wa = (1 - ax) * (1 - ay) * weight;
  const wb = ax * (1 - ay) * weight;
  const wc = (1 - ax) * ay * weight;
  const wd = ax * ay * weight;
  out[at] = out[at]! + rgb[a]! * wa + rgb[b]! * wb + rgb[c]! * wc + rgb[d]! * wd;
  out[at + 1] = out[at + 1]! + rgb[a + 1]! * wa + rgb[b + 1]! * wb + rgb[c + 1]! * wc + rgb[d + 1]! * wd;
  out[at + 2] = out[at + 2]! + rgb[a + 2]! * wa + rgb[b + 2]! * wb + rgb[c + 2]! * wc + rgb[d + 2]! * wd;
}
