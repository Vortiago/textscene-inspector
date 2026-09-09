/**
 * Godot's `Transform2D` as the particle port needs it.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

import type { Vector2 } from '../../base/node2d/types';

/**
 * A Godot `Transform2D`: two basis columns plus the origin column. Named after
 * the columns rather than as a matrix so the port reads like the C++.
 */
export interface Affine2D {
  /** `columns[0]` — the local X axis. */
  ax: number;
  ay: number;
  /** `columns[1]` — the local Y axis. */
  bx: number;
  by: number;
  /** `columns[2]` — the origin. */
  ox: number;
  oy: number;
}

export const IDENTITY_AFFINE: Affine2D = { ax: 1, ay: 0, bx: 0, by: 1, ox: 0, oy: 0 };

/** `Transform2D::basis_xform` — the linear part only. */
export function basisXform(t: Affine2D, v: Vector2): Vector2 {
  return { x: t.ax * v.x + t.bx * v.y, y: t.ay * v.x + t.by * v.y };
}

/** `Transform2D::operator*` — `a` applied to `b`. */
export function multiplyAffine(a: Affine2D, b: Affine2D): Affine2D {
  const col0 = basisXform(a, { x: b.ax, y: b.ay });
  const col1 = basisXform(a, { x: b.bx, y: b.by });
  const origin = basisXform(a, { x: b.ox, y: b.oy });
  return {
    ax: col0.x,
    ay: col0.y,
    bx: col1.x,
    by: col1.y,
    ox: origin.x + a.ox,
    oy: origin.y + a.oy,
  };
}

/**
 * `Transform2D::affine_inverse`. A singular transform (a scene that scales a
 * node to zero) has no inverse; Godot's own `ERR_FAIL_COND` leaves the matrix
 * untouched, so we answer identity rather than propagate NaN through the pose.
 */
export function affineInverse(t: Affine2D): Affine2D {
  const det = t.ax * t.by - t.ay * t.bx;
  if (det === 0 || !Number.isFinite(det)) return { ...IDENTITY_AFFINE };
  const idet = 1 / det;
  const ax = t.by * idet;
  const ay = -t.ay * idet;
  const bx = -t.bx * idet;
  const by = t.ax * idet;
  return {
    ax,
    ay,
    bx,
    by,
    ox: -(ax * t.ox + bx * t.oy),
    oy: -(ay * t.ox + by * t.oy),
  };
}
