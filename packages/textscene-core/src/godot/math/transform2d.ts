/**
 * `Transform2D` (`core/math/transform_2d.h`) as six numbers, +Y down. The linter's global-transform
 * verdicts and the previewer's 2D placement build a Node2D's local transform, compose a chain,
 * invert it and read its scale through these functions, so a static verdict and a drawn position
 * cannot disagree.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { isEqualApprox, isZeroApprox, sign } from './math.js';
import { storedReal as f } from './real.js';
import { normalizedVector2, type Vector2 } from './vector.js';

/**
 * `columns[0] = (a, b)` is the x axis, `columns[1] = (c, d)` the y axis and `columns[2] = (tx, ty)`
 * the origin, so a point maps to `(a*x + c*y + tx, b*x + d*y + ty)`.
 */
export interface Transform2DColumns {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

export const TRANSFORM2D_IDENTITY: Transform2DColumns = Object.freeze({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: 0,
  ty: 0,
});

/**
 * `Transform2D(rot, scale, skew, pos)` (`transform_2d.cpp:107-113`), as `Node2D::_update_transform`
 * builds it (`node_2d.cpp:135-137`), in `real_t` float. `c` is `0 - v`, not the engine's `-v`: they
 * differ only in a zero's sign, which no reader here tells apart, and an unrotated transform equals
 * the identity.
 */
export function transform2DFromParts(
  rotation: number,
  scale: { readonly x: number; readonly y: number },
  skew: number,
  position: { readonly x: number; readonly y: number }
): Transform2DColumns {
  const skewed = f(f(rotation) + f(skew));
  const sx = f(scale.x);
  const sy = f(scale.y);
  return {
    a: f(f(Math.cos(f(rotation))) * sx),
    b: f(f(Math.sin(f(rotation))) * sx),
    c: 0 - f(f(Math.sin(skewed)) * sy),
    d: f(f(Math.cos(skewed)) * sy),
    tx: f(position.x),
    ty: f(position.y),
  };
}

/**
 * `Transform2D::operator*` (`transform_2d.cpp:198-218`) in `real_t` float: `parent * local`, which
 * maps a point through `local`, then `parent`, as `CanvasItem::get_global_transform()` composes a
 * chain, each multiply and add rounded as C++ rounds a `float`.
 *
 * @canonical A Transform2D product in float32
 */
export function multiplyTransform2D(
  parent: Transform2DColumns,
  local: Transform2DColumns
): Transform2DColumns {
  const origin = transform2DXform(parent, { x: local.tx, y: local.ty });
  return {
    a: f(f(parent.a * local.a) + f(parent.c * local.b)),
    b: f(f(parent.b * local.a) + f(parent.d * local.b)),
    c: f(f(parent.a * local.c) + f(parent.c * local.d)),
    d: f(f(parent.b * local.c) + f(parent.d * local.d)),
    tx: origin.x,
    ty: origin.y,
  };
}

/**
 * `Transform2D::basis_xform` (`transform_2d.h`, `tdotx` and `tdoty`) in `real_t` float. Not
 * transform2DXform with a zero origin: adding +0 turns a -0 component into +0.
 *
 * @canonical A vector through a Transform2D basis in float32
 */
export function transform2DBasisXform(t: Transform2DColumns, v: Vector2): Vector2 {
  return transform2DBasisXformInto({ x: 0, y: 0 }, t, v);
}

/**
 * {@link transform2DBasisXform} written into `out`, for a loop that allocates nothing. `out` may be `v`.
 *
 * @canonical A vector through a Transform2D basis in float32, written in place
 */
export function transform2DBasisXformInto(out: Vector2, t: Transform2DColumns, v: Vector2): Vector2 {
  const x = f(f(t.a * v.x) + f(t.c * v.y));
  out.y = f(f(t.b * v.x) + f(t.d * v.y));
  out.x = x;
  return out;
}

/**
 * `Transform2D::xform` (`transform_2d.h`, `tdotx` and `tdoty` plus the origin) in `real_t` float.
 *
 * @canonical A point through a Transform2D in float32
 */
export function transform2DXform(t: Transform2DColumns, v: Vector2): Vector2 {
  return {
    x: f(f(f(t.a * v.x) + f(t.c * v.y)) + t.tx),
    y: f(f(f(t.b * v.x) + f(t.d * v.y)) + t.ty),
  };
}

/**
 * `Transform2D::affine_invert` (`transform_2d.cpp:48-66`) in `real_t` float. A singular transform,
 * such as a node scaled to zero, has none: the engine's `ERR_FAIL_COND` (`:51`, `MATH_CHECKS` only)
 * returns it unchanged. Each caller draws through that singular transform, so no answer is visible,
 * and this returns the identity for a zero or non-finite determinant to keep NaN out of the scene
 * graph.
 *
 * @canonical A Transform2D inverse in float32
 */
export function affineInverseTransform2D(t: Transform2DColumns): Transform2DColumns {
  const det = f(f(t.a * t.d) - f(t.b * t.c));
  if (det === 0 || !Number.isFinite(det)) return TRANSFORM2D_IDENTITY;
  const idet = f(1 / det);
  const a = f(t.d * idet);
  const b = f(t.b * -idet);
  const c = f(t.c * -idet);
  const d = f(t.a * idet);
  const origin = transform2DBasisXform({ a, b, c, d, tx: 0, ty: 0 }, { x: -t.tx, y: -t.ty });
  return { a, b, c, d, tx: origin.x, ty: origin.y };
}

/**
 * `Transform2D::get_scale()` (`transform_2d.cpp:115-118`): the x column's length, and the y
 * column's signed by the determinant. The engine's `SIGN` (`typedefs.h:123-126`), not `Math.sign`:
 * they differ on NaN, which a serialised `nan` puts into the determinant while the y column stays
 * finite. A zero determinant zeroes the signed half.
 */
export function transform2DGetScale(t: Transform2DColumns): { x: number; y: number } {
  const det = t.a * t.d - t.c * t.b;
  return {
    x: Math.hypot(t.a, t.b),
    y: sign(det) * Math.hypot(t.c, t.d),
  };
}

/**
 * `Transform2D::set_scale` (`transform_2d.cpp:120-125`): each axis keeps its direction at the length
 * `scale` names. The engine's `normalize` leaves a zero axis at zero, and the origin stays.
 */
export function transform2DSetScale(
  t: Transform2DColumns,
  scale: { x: number; y: number }
): Transform2DColumns {
  const x = normalizedVector2({ x: t.a, y: t.b });
  const y = normalizedVector2({ x: t.c, y: t.d });
  return {
    ...t,
    a: f(x.x * scale.x),
    b: f(x.y * scale.x),
    c: f(y.x * scale.y),
    d: f(y.y * scale.y),
  };
}

/**
 * The position, rotation, scale and skew a Node2D reads from its transform
 * (`Node2D::_update_xform_values`, `node_2d.cpp:127-133`): `get_rotation` is the angle of the x axis
 * (`transform_2d.cpp:82-84`), `get_scale` is {@link transform2DGetScale}, and `get_skew`
 * (`transform_2d.cpp:72-75`) is the angle of the y axis from perpendicular to the x axis, its
 * direction mirrored with the sign of the determinant. It is the inverse of {@link transform2DFromParts}.
 */
export function transform2DDecompose(t: Transform2DColumns): {
  position: Vector2;
  rotation: number;
  scale: { x: number; y: number };
  skew: number;
} {
  const detSign = sign(t.a * t.d - t.c * t.b);
  const x = normalizedVector2({ x: t.a, y: t.b });
  const y = normalizedVector2({ x: t.c, y: t.d });
  // The dot of unit vectors can round past 1, where `acos` has no answer.
  const cosine = Math.max(-1, Math.min(1, x.x * detSign * y.x + x.y * detSign * y.y));
  return {
    position: { x: t.tx, y: t.ty },
    rotation: Math.atan2(t.b, t.a),
    scale: transform2DGetScale(t),
    skew: Math.acos(cosine) - Math.PI / 2,
  };
}

/**
 * `Transform2D::is_conformal()` (`transform_2d.cpp:167-179`): the axes are equal-length and
 * perpendicular, allowing a single shared reflection.
 */
export function transform2DIsConformal(t: Transform2DColumns): boolean {
  const { a, b, c, d } = t;
  const nonFlipped = isEqualApprox(a, d) && isEqualApprox(b, -c);
  const flipped = isEqualApprox(a, -d) && isEqualApprox(b, c);
  return nonFlipped || flipped;
}

/**
 * Whether the two axes are orthogonal, the zero-skew case of `Transform2D::get_skew()`
 * (`transform_2d.cpp:72-75`). Godot compares its cached `get_global_skew()` exactly against 0.0,
 * but this recomputes by another path, so `isZeroApprox` on the normalised dot product absorbs
 * `cos`/`sin` residue while a few degrees of real skew stay clear.
 */
export function transform2DHasZeroSkew(t: Transform2DColumns): boolean {
  const { a, b, c, d } = t;
  const len0 = Math.hypot(a, b);
  const len1 = Math.hypot(c, d);
  // `Vector2::normalize()` (`core/math/vector2.cpp:52-58`) leaves a zero vector at
  // `(0, 0)`, so `get_skew()` is exactly 0, where a division would give NaN. Godot
  // stays silent on skew here and below, though the zero-scale check trips.
  if (len0 === 0 || len1 === 0) return true;
  // Parallel non-zero axes: `get_skew()` multiplies by `SIGN(det)`, exactly 0
  // (`typedefs.h:123-126`). Exact, like `SIGN`: at `det == 1e-30` the sign is `+1`
  // and Godot reports skew.
  if (a * d - c * b === 0) return true;
  const normalizedDot = (a * c + b * d) / (len0 * len1);
  return isZeroApprox(normalizedDot);
}
