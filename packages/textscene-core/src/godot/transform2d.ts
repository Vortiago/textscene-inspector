/**
 * `Transform2D` (`core/math/transform_2d.h`) as six numbers, +Y down. The linter's global-transform
 * verdicts and the previewer's 2D placement build a Node2D's local transform, compose a chain and
 * invert it through these functions, so a static verdict and a drawn position cannot disagree.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

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
 * builds it (`node_2d.cpp:135-137`). `c` is `0 - v`, not the engine's `-v`: they differ only in a
 * zero's sign, which no reader here tells apart, and an unrotated transform equals the identity.
 */
export function transform2DFromParts(
  rotation: number,
  scale: { readonly x: number; readonly y: number },
  skew: number,
  position: { readonly x: number; readonly y: number }
): Transform2DColumns {
  return {
    a: Math.cos(rotation) * scale.x,
    b: Math.sin(rotation) * scale.x,
    c: 0 - Math.sin(rotation + skew) * scale.y,
    d: Math.cos(rotation + skew) * scale.y,
    tx: position.x,
    ty: position.y,
  };
}

/**
 * `Transform2D::operator*` (`transform_2d.cpp:198-218`): `parent * local`, which maps a point
 * through `local`, then `parent`, as `CanvasItem::get_global_transform()` composes a chain.
 */
export function multiplyTransform2D(
  parent: Transform2DColumns,
  local: Transform2DColumns
): Transform2DColumns {
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    tx: parent.a * local.tx + parent.c * local.ty + parent.tx,
    ty: parent.b * local.tx + parent.d * local.ty + parent.ty,
  };
}

/**
 * `Transform2D::affine_inverse` (`transform_2d.cpp:48-66`). A singular transform, such as a node
 * scaled to zero, has none: the engine's `ERR_FAIL_COND` (`:51`, `MATH_CHECKS` only) returns it
 * unchanged. Each caller draws through that singular transform, so no answer is visible, and this
 * returns the identity for a zero or non-finite determinant to keep NaN out of the scene graph.
 */
export function affineInverseTransform2D(t: Transform2DColumns): Transform2DColumns {
  const det = t.a * t.d - t.b * t.c;
  if (det === 0 || !Number.isFinite(det)) return TRANSFORM2D_IDENTITY;
  const idet = 1 / det;
  const a = t.d * idet;
  const b = -t.b * idet;
  const c = -t.c * idet;
  const d = t.a * idet;
  return { a, b, c, d, tx: -(a * t.tx + c * t.ty), ty: -(b * t.tx + d * t.ty) };
}
