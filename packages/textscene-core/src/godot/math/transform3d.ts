/** Godot's `Transform3D` (`core/math/transform_3d.h`) as plain components. */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { storedReal as f } from './real.js';
import {
  basisFromQuaternionScale,
  basisGetRotationQuaternion,
  basisGetScale,
  basisInvert,
  basisMultiply,
  type BasisComponents,
} from './basis.js';
import { normalizedQuaternion, quaternionSlerp, type Quaternion } from './quaternion.js';
import { vector3Lerp, type Vector3 } from './vector.js';

/**
 * A 3D transform, written `Transform3D(basis_x.xyz, basis_y.xyz, basis_z.xyz, origin.xyz)`.
 * Godot stores Basis as `Vector3 rows[3]`: basis_x, basis_y and basis_z are the rows of the 3×3
 * matrix, not the columns (utils/transform.ts has the convention), and origin is the fourth column.
 */
export interface Transform3D {
  basis_x: Vector3;
  basis_y: Vector3;
  basis_z: Vector3;
  origin: Vector3;
}

/**
 * A fresh `Transform3D()`: the identity rows `Basis` initialises (`core/math/basis.h:41-45`) and a
 * zero origin (`transform_3d.h:44`). Fresh, so a caller may mutate it.
 */
export function identityTransform3D(): Transform3D {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: 0, z: 0 },
  };
}

/** The nine row-major components of the basis. */
function basisComponents({ basis_x: x, basis_y: y, basis_z: z }: Transform3D): BasisComponents {
  return [x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z];
}

function transformOf(n: BasisComponents, origin: Vector3): Transform3D {
  return {
    basis_x: { x: n[0], y: n[1], z: n[2] },
    basis_y: { x: n[3], y: n[4], z: n[5] },
    basis_z: { x: n[6], y: n[7], z: n[8] },
    origin,
  };
}

/** `Transform3D::xform` (`transform_3d.h:177-182`) of a point: each basis row dotted with it, plus the origin. */
function xformPoint(transform: Transform3D, point: Vector3): Vector3 {
  const rowDot = ({ x, y, z }: Vector3): number => f(f(f(x * point.x) + f(y * point.y)) + f(z * point.z));
  return {
    x: f(rowDot(transform.basis_x) + transform.origin.x),
    y: f(rowDot(transform.basis_y) + transform.origin.y),
    z: f(rowDot(transform.basis_z) + transform.origin.z),
  };
}

/** Whether two transforms hold the same twelve components, as `Transform3D::operator==` reads them. */
export function sameTransform3D(a: Transform3D, b: Transform3D): boolean {
  return (
    sameVector3(a.basis_x, b.basis_x) &&
    sameVector3(a.basis_y, b.basis_y) &&
    sameVector3(a.basis_z, b.basis_z) &&
    sameVector3(a.origin, b.origin)
  );
}

/** `===`, except that a NaN equals a NaN, so a skin with a NaN in it can still be found unchanged. */
function sameComponent(a: number, b: number): boolean {
  return a === b || (a !== a && b !== b);
}

function sameVector3(a: Vector3, b: Vector3): boolean {
  return sameComponent(a.x, b.x) && sameComponent(a.y, b.y) && sameComponent(a.z, b.z);
}

/**
 * `Transform3D::operator*` (`transform_3d.cpp:184-193`): `left * right` takes a point through `right`,
 * then `left`, as a child's global transform is its parent's times its own.
 *
 * @canonical A Transform3D product, its affine inverse and a pose from a quaternion and a scale
 *   `multiplyTransform3D`, `affineInverseTransform3D` and `transform3DFromQuaternionScale`, in float32.
 */
export function multiplyTransform3D(left: Transform3D, right: Transform3D): Transform3D {
  return transformOf(
    basisMultiply(basisComponents(left), basisComponents(right)),
    xformPoint(left, right.origin)
  );
}

/**
 * `Transform3D::affine_inverse` (`transform_3d.cpp:35-44`): the basis inverted, then the negated
 * origin taken through it. A singular basis stays as it is, as `Basis::invert` leaves it.
 */
export function affineInverseTransform3D(transform: Transform3D): Transform3D {
  const inverse = transformOf(basisInvert(basisComponents(transform)), { x: 0, y: 0, z: 0 });
  const { x, y, z } = transform.origin;
  return { ...inverse, origin: xformPoint(inverse, { x: -x, y: -y, z: -z }) };
}

/** The transform `Skeleton3D::Bone::update_pose_cache` builds (`skeleton_3d.h:118-124`): `Basis(rotation, scale)` at `position`. */
export function transform3DFromQuaternionScale(
  rotation: Quaternion,
  scale: Vector3,
  position: Vector3
): Transform3D {
  return transformOf(basisFromQuaternionScale(rotation, scale), { ...position });
}

/**
 * The rotation and the scale `Basis::get_rotation_quaternion` and `Basis::get_scale` read from the
 * basis of a transform, which a pose keeps apart (`Skeleton3D::set_bone_pose`).
 *
 * @canonical The rotation and the scale of a Transform3D
 */
export function decomposeTransform3D(transform: Transform3D): { rotation: Quaternion; scale: Vector3 } {
  const basis = basisComponents(transform);
  const [x, y, z] = basisGetScale(basis);
  return { rotation: basisGetRotationQuaternion(basis), scale: { x, y, z } };
}

/**
 * `Transform3D::interpolate_with` (`transform_3d.cpp:96-111`): the rotation slerped, the scale and
 * the origin lerped, each from `from` to `to` by `weight`. A shear in either basis is dropped.
 *
 * @canonical A Transform3D between two others
 */
export function interpolateTransform3D(from: Transform3D, to: Transform3D, weight: number): Transform3D {
  const start = decomposeTransform3D(from);
  const end = decomposeTransform3D(to);
  return transform3DFromQuaternionScale(
    normalizedQuaternion(quaternionSlerp(start.rotation, end.rotation, weight)),
    vector3Lerp(start.scale, end.scale, weight),
    vector3Lerp(from.origin, to.origin, weight)
  );
}
