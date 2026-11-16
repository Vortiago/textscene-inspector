import {
  basisMultiply,
  basisOrthonormalized,
  IDENTITY_BASIS,
  type BasisComponents,
  type MutableBasis,
} from '../../math/basis.js';
import { basisScale, basisSetAxisAngle, basisXform } from '../../math/basisFloat.js';
import { isEqualApproxf } from '../../math/realMath.js';
import {
  affineInverseTransform3D,
  basisOfTransform3D,
  identityTransform3D,
  interpolateTransform3D,
  transform3DOf,
  type Transform3D,
} from '../../math/transform3d.js';
import { vector3Add, vector3Sub, type Vector3 } from '../../math/vector.js';
import { transposeBasis } from '../operators/matrices.js';
import { valueAt } from '../utility/utilityArguments.js';
import { bool, variant, type Variant } from '../value/variant.js';
import { basisLookingAt, basisRotated, basisScaledLocal } from './basisMethods.js';
import { portOn, valueOf, type MethodPort } from './methodPort.js';

const f = Math.fround;
const LANES = ['x', 'y', 'z'] as const;

const transformOf = (t: Transform3D): Variant => variant('TRANSFORM3D', t);
const transformAt = valueAt<Transform3D>;
const vectorAt = valueAt<Vector3>;

const port = portOn(valueOf<Transform3D>);

const negated = ({ x, y, z }: Vector3): Vector3 => ({ x: -x, y: -y, z: -z });

const withBasis = (t: Transform3D, n: BasisComponents) => transform3DOf(n, t.origin);

// transform_3d.cpp:46: the transpose of the basis, which inverts only a rotation.
function inverse(t: Transform3D): Transform3D {
  const transposed = transposeBasis(basisOfTransform3D(t));
  return transform3DOf(transposed, basisXform(transposed, negated(t.origin)));
}

const turn = (axis: Vector3, angle: number) => basisSetAxisAngle([...IDENTITY_BASIS], axis, angle);

// transform_3d.cpp:59: the turn applies to the origin too.
function rotated(t: Transform3D, axis: Vector3, angle: number): Transform3D {
  const turned = basisRotated(basisOfTransform3D(t), axis, angle);
  return transform3DOf(turned, basisXform(turn(axis, angle), t.origin));
}

const rotatedLocal = (t: Transform3D, axis: Vector3, angle: number) =>
  withBasis(t, basisMultiply(basisOfTransform3D(t), turn(axis, angle)));

function scaled(t: Transform3D, scale: Vector3): Transform3D {
  const n = basisScale([...basisOfTransform3D(t)] as MutableBasis, scale.x, scale.y, scale.z);
  const { x, y, z } = t.origin;
  return transform3DOf(n, { x: f(x * scale.x), y: f(y * scale.y), z: f(z * scale.z) });
}

const translatedLocal = (t: Transform3D, offset: Vector3) =>
  transform3DOf(basisOfTransform3D(t), vector3Add(t.origin, basisXform(basisOfTransform3D(t), offset)));

const isEqualApproxVector = (a: Vector3, b: Vector3) =>
  LANES.every((lane) => isEqualApproxf(a[lane], b[lane]));

// transform_3d.cpp:80: MATH_CHECKS gives `Transform3D()` for a target at the origin.
function lookingAt(t: Transform3D, target: Vector3, up: Vector3, isModelFront: boolean): Transform3D {
  if (isEqualApproxVector(t.origin, target)) return identityTransform3D();
  return withBasis(t, basisLookingAt(vector3Sub(target, t.origin), up, isModelFront));
}

const rowsOf = (t: Transform3D) => [t.basis_x, t.basis_y, t.basis_z, t.origin];

export const TRANSFORM3D_METHODS: Readonly<Record<string, MethodPort>> = {
  inverse: port([], (t) => transformOf(inverse(t))),
  affine_inverse: port([], (t) => transformOf(affineInverseTransform3D(t))),
  orthonormalized: port([], (t) => transformOf(withBasis(t, basisOrthonormalized(basisOfTransform3D(t))))),
  rotated: port(['VECTOR3', 'float'], (t, args) =>
    transformOf(rotated(t, vectorAt(args, 0), args[1] as number))
  ),
  rotated_local: port(['VECTOR3', 'float'], (t, args) =>
    transformOf(rotatedLocal(t, vectorAt(args, 0), args[1] as number))
  ),
  scaled: port(['VECTOR3'], (t, args) => transformOf(scaled(t, vectorAt(args, 0)))),
  scaled_local: port(['VECTOR3'], (t, args) =>
    transformOf(withBasis(t, basisScaledLocal(basisOfTransform3D(t), vectorAt(args, 0))))
  ),
  translated: port(['VECTOR3'], (t, args) =>
    transformOf(transform3DOf(basisOfTransform3D(t), vector3Add(t.origin, vectorAt(args, 0))))
  ),
  translated_local: port(['VECTOR3'], (t, args) => transformOf(translatedLocal(t, vectorAt(args, 0)))),
  looking_at: port(['VECTOR3', 'VECTOR3', 'bool'], (t, args) =>
    transformOf(lookingAt(t, vectorAt(args, 0), vectorAt(args, 1), args[2] as boolean))
  ),
  interpolate_with: port(['TRANSFORM3D', 'float'], (t, args) =>
    transformOf(interpolateTransform3D(t, transformAt(args, 0), args[1] as number))
  ),
  is_equal_approx: port(['TRANSFORM3D'], (t, args) => {
    const other = rowsOf(transformAt(args, 0));
    return bool(rowsOf(t).every((row, index) => isEqualApproxVector(row, other[index]!)));
  }),
  is_finite: port([], (t) =>
    bool(rowsOf(t).every((row) => LANES.every((lane) => Number.isFinite(row[lane]))))
  ),
};
