import { isEqualApproxf } from '../../math/realMath.js';
import {
  multiplyTransform2D,
  transform2DAffineInverse,
  transform2DBasisXform,
  transform2DDeterminant,
  transform2DFromRotation,
  transform2DGetRotation,
  transform2DGetScale,
  transform2DGetSkew,
  transform2DInterpolateWith,
  transform2DIsConformal,
  transform2DLookingAt,
  transform2DOrigin,
  type Transform2DColumns,
} from '../../math/transform2d.js';
import {
  normalizedVector2,
  vector2Add,
  vector2Dot,
  vector2Scaled,
  vector2Sub,
  type Vector2,
} from '../../math/vector.js';
import { valueAt } from '../utility/utilityArguments.js';
import { bool, real, variant, vector2, type Variant } from '../value/variant.js';
import { portOn, valueOf, type MethodPort } from './methodPort.js';

const f = Math.fround;
const ORIGIN: Vector2 = { x: 0, y: 0 };

const transformOf = (t: Transform2DColumns): Variant => variant('TRANSFORM2D', t);
const transformAt = valueAt<Transform2DColumns>;
const vectorAt = valueAt<Vector2>;

const port = portOn(valueOf<Transform2DColumns>);

const xAxis = ({ a, b }: Transform2DColumns): Vector2 => ({ x: a, y: b });
const yAxis = ({ c, d }: Transform2DColumns): Vector2 => ({ x: c, y: d });

const withAxes = (x: Vector2, y: Vector2, origin: Vector2): Transform2DColumns => ({
  a: x.x,
  b: x.y,
  c: y.x,
  d: y.y,
  tx: origin.x,
  ty: origin.y,
});

// transform_2d.cpp:35: the transpose of the basis, which inverts only a rotation.
function inverse(t: Transform2DColumns): Transform2DColumns {
  const turned = { ...t, b: t.c, c: t.b };
  return { ...turned, ...asOrigin(transform2DBasisXform(turned, { x: -t.tx, y: -t.ty })) };
}

const asOrigin = ({ x, y }: Vector2) => ({ tx: x, ty: y });

// transform_2d.cpp:132: Gram-Schmidt on the two axes.
function orthonormalized(t: Transform2DColumns): Transform2DColumns {
  const x = normalizedVector2(xAxis(t));
  const y = normalizedVector2(vector2Sub(yAxis(t), vector2Scaled(x, vector2Dot(x, yAxis(t)))));
  return withAxes(x, y, transform2DOrigin(t));
}

// transform_2d.cpp:98: `scale_basis` scales each row, then the origin.
function scaled(t: Transform2DColumns, { x, y }: Vector2): Transform2DColumns {
  return {
    a: f(t.a * x),
    b: f(t.b * y),
    c: f(t.c * x),
    d: f(t.d * y),
    tx: f(t.tx * x),
    ty: f(t.ty * y),
  };
}

const scaledLocal = (t: Transform2DColumns, { x, y }: Vector2) =>
  withAxes(vector2Scaled(xAxis(t), x), vector2Scaled(yAxis(t), y), transform2DOrigin(t));

const translated = (t: Transform2DColumns, offset: Vector2) =>
  withAxes(xAxis(t), yAxis(t), vector2Add(transform2DOrigin(t), offset));

const translatedLocal = (t: Transform2DColumns, offset: Vector2) =>
  translated(t, transform2DBasisXform(t, offset));

const rotation = (angle: number) => transform2DFromRotation(angle, ORIGIN);

const basisXformInverse = (t: Transform2DColumns, v: Vector2): Vector2 => ({
  x: vector2Dot(xAxis(t), v),
  y: vector2Dot(yAxis(t), v),
});

const COMPONENTS = ['a', 'b', 'c', 'd', 'tx', 'ty'] as const;

export const TRANSFORM2D_METHODS: Readonly<Record<string, MethodPort>> = {
  inverse: port([], (t) => transformOf(inverse(t))),
  affine_inverse: port([], (t) => transformOf(transform2DAffineInverse(t))),
  get_rotation: port([], (t) => real(transform2DGetRotation(t))),
  get_origin: port([], (t) => vector2(transform2DOrigin(t))),
  get_scale: port([], (t) => vector2(transform2DGetScale(t))),
  get_skew: port([], (t) => real(transform2DGetSkew(t))),
  orthonormalized: port([], (t) => transformOf(orthonormalized(t))),
  rotated: port(['float'], (t, args) => transformOf(multiplyTransform2D(rotation(args[0] as number), t))),
  rotated_local: port(['float'], (t, args) =>
    transformOf(multiplyTransform2D(t, rotation(args[0] as number)))
  ),
  scaled: port(['VECTOR2'], (t, args) => transformOf(scaled(t, vectorAt(args, 0)))),
  scaled_local: port(['VECTOR2'], (t, args) => transformOf(scaledLocal(t, vectorAt(args, 0)))),
  translated: port(['VECTOR2'], (t, args) => transformOf(translated(t, vectorAt(args, 0)))),
  translated_local: port(['VECTOR2'], (t, args) => transformOf(translatedLocal(t, vectorAt(args, 0)))),
  determinant: port([], (t) => real(transform2DDeterminant(t))),
  basis_xform: port(['VECTOR2'], (t, args) => vector2(transform2DBasisXform(t, vectorAt(args, 0)))),
  basis_xform_inv: port(['VECTOR2'], (t, args) => vector2(basisXformInverse(t, vectorAt(args, 0)))),
  interpolate_with: port(['TRANSFORM2D', 'float'], (t, args) =>
    transformOf(transform2DInterpolateWith(t, transformAt(args, 0), args[1] as number))
  ),
  is_conformal: port([], (t) => bool(transform2DIsConformal(t))),
  is_equal_approx: port(['TRANSFORM2D'], (t, args) => {
    const other = transformAt(args, 0);
    return bool(COMPONENTS.every((name) => isEqualApproxf(t[name], other[name])));
  }),
  is_finite: port([], (t) => bool(COMPONENTS.every((name) => Number.isFinite(t[name])))),
  looking_at: port(['VECTOR2'], (t, args) => transformOf(transform2DLookingAt(t, vectorAt(args, 0)))),
};
