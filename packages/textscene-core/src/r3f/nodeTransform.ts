/**
 * Maps a Godot Transform3D onto R3F group props: tuples for `<group position rotation scale>`,
 * plus an `updateMatrix` that keeps a shear those three cannot express. Consumers apply them
 * through `node3dGroupSpread`.
 */

import * as THREE from 'three';
import type { Node3DProperties } from '../nodes/base/node3d/types';
import type { Transform3D } from '../godot/math/transform3d';
import { decomposeTransform3D } from '../utils/transform';

export type Vec3Tuple = [number, number, number];

export interface NodeTransform {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  /**
   * Set only for a sheared basis: composes position, rotation and scale, then the fixed shear
   * they leave out. An animation or a fixed-size hook that rewrites the parts keeps the shear.
   */
  updateMatrix?: UpdateMatrix;
}

type UpdateMatrix = (this: THREE.Object3D) => void;

// Float32-serialised bases leave about 1e-7 of relative non-orthogonality in a pure rotation.
const SHEAR_TOLERANCE = 1e-5;

const IDENTITY_TRANSFORM: NodeTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

/** Whether two basis columns are not perpendicular: rotation and scale alone give perpendicular ones. */
function hasShear({ basis_x: x, basis_y: y, basis_z: z }: Transform3D): boolean {
  const columns: Vec3Tuple[] = [
    [x.x, y.x, z.x],
    [x.y, y.y, z.y],
    [x.z, y.z, z.z],
  ];
  const dot = (a: Vec3Tuple, b: Vec3Tuple) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const isSkewed = (a: Vec3Tuple, b: Vec3Tuple) =>
    Math.abs(dot(a, b)) > SHEAR_TOLERANCE * Math.sqrt(dot(a, a) * dot(b, b));
  const [cx, cy, cz] = columns as [Vec3Tuple, Vec3Tuple, Vec3Tuple];
  return isSkewed(cx, cy) || isSkewed(cx, cz) || isSkewed(cy, cz);
}

function matrixOfTransform3D({ basis_x: x, basis_y: y, basis_z: z, origin: o }: Transform3D): THREE.Matrix4 {
  return new THREE.Matrix4().set(x.x, x.y, x.z, o.x, y.x, y.y, y.z, o.y, z.x, z.y, z.z, o.z, 0, 0, 0, 1);
}

/**
 * An `updateMatrix` for an object whose authored matrix is `matrix` at the discrete parts. The
 * shear is what the parts leave out, so the result is `parts * shear`, and an object left at its
 * authored parts gets `matrix` back.
 */
function updateMatrixWithShear(parts: NodeTransform, matrix: THREE.Matrix4): UpdateMatrix {
  const shear = composeParts(parts).invert().multiply(matrix);
  return function updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale).multiply(shear);
    this.matrixWorldNeedsUpdate = true;
  };
}

function composeParts({ position, rotation, scale }: NodeTransform): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale)
  );
}

export function decomposeForR3F(transform: Transform3D | undefined): NodeTransform {
  if (!transform) return IDENTITY_TRANSFORM;
  const { position, rotation, scale } = decomposeTransform3D(transform);
  const parts: NodeTransform = {
    position: [position.x, position.y, position.z],
    rotation: [rotation.x, rotation.y, rotation.z],
    scale: [scale.x, scale.y, scale.z],
  };
  if (!hasShear(transform)) return parts;
  return { ...parts, updateMatrix: updateMatrixWithShear(parts, matrixOfTransform3D(transform)) };
}

// Always spread, so R3F never resets a removed `updateMatrix` prop to undefined.
/** The object's own compose, for a transform with no shear to hold. */
export const PLAIN_UPDATE_MATRIX: UpdateMatrix = THREE.Object3D.prototype.updateMatrix;

/** Spreadable `<group>` transform props: the discrete parts and the `updateMatrix` that holds them. */
export function node3dGroupSpread(t: NodeTransform): {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  updateMatrix: UpdateMatrix;
} {
  return {
    position: t.position,
    rotation: t.rotation,
    scale: t.scale,
    updateMatrix: t.updateMatrix ?? PLAIN_UPDATE_MATRIX,
  };
}

export function transformFromNode3DProperties(properties: Node3DProperties): NodeTransform {
  return decomposeForR3F(properties.transform);
}
