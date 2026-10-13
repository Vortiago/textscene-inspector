/**
 * The WebGL cube map layout the sky's cubes follow: faces +X, -X, +Y, -Y, +Z, -Z, and on each face
 * `s` along a texel row and `t` across the rows, from the first row up (OpenGL ES 3.0 table 3.21).
 */

import type { OctDirection } from '../../godot/octmap.js';

/** The unit direction through the centre of texel `texel` of `face`, on a cube `size` wide. */
export function texelDirection(face: number, texel: number, size: number): OctDirection {
  const s = texelCentre(texel % size, size);
  const t = texelCentre(Math.floor(texel / size), size);
  const [x, y, z] = faceDirection(face, s, t);
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

/** The face `direction` falls in: the face of its largest component. */
export function cubeFace([x, y, z]: OctDirection): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (ax >= ay && ax >= az) return x > 0 ? 0 : 1;
  if (ay >= az) return y > 0 ? 2 : 3;
  return z > 0 ? 4 : 5;
}

/** The index of the texel `direction` falls in, on its face of a cube `size` wide. */
export function cubeTexel(direction: OctDirection, size: number): number {
  const face = cubeFace(direction);
  const major = Math.abs(direction[face >> 1]!);
  const [x, y, z] = direction;
  const s = (face === 0 ? -z : face === 1 ? z : face === 5 ? -x : x) / major;
  const t = (face === 2 ? z : face === 3 ? -z : -y) / major;
  const col = Math.min(Math.floor(((s + 1) / 2) * size), size - 1);
  const row = Math.min(Math.floor(((t + 1) / 2) * size), size - 1);
  return row * size + col;
}

/** The centre of texel `index` of `size`, in -1..1. */
function texelCentre(index: number, size: number): number {
  return ((index + 0.5) * 2) / size - 1;
}

/** The unnormalised direction at `s`, `t` in -1..1 on `face`. */
function faceDirection(face: number, s: number, t: number): OctDirection {
  switch (face) {
    case 0:
      return [1, -t, -s];
    case 1:
      return [-1, -t, s];
    case 2:
      return [s, 1, t];
    case 3:
      return [s, -1, -t];
    case 4:
      return [s, -t, 1];
    default:
      return [-s, -t, -1];
  }
}
