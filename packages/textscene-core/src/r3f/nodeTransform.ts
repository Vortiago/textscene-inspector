/**
 * Maps a Godot Transform3D onto R3F group props: tuples for `<group position rotation scale>`,
 * or the whole basis as a `matrix` when it holds a shear, which those three cannot express.
 * Consumers apply either through `node3dGroupSpread`.
 */

import * as THREE from 'three';
import type { Node3DProperties } from '../nodes/base/node3d/types';
import type { Transform3D } from '../godot/math/transform3d';
import { decomposeTransform3D } from '../utils/transform';
import { BillboardMode } from '../godot/rendering/materials/billboardMode';

export type Vec3Tuple = [number, number, number];

export interface NodeTransform {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  /** Set only for a sheared basis, which `matrixAutoUpdate=false` keeps from being recomposed. */
  matrix?: THREE.Matrix4;
}

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

export function decomposeForR3F(transform: Transform3D | undefined): NodeTransform {
  if (!transform) return IDENTITY_TRANSFORM;
  const { position, rotation, scale } = decomposeTransform3D(transform);
  const parts: NodeTransform = {
    position: [position.x, position.y, position.z],
    rotation: [rotation.x, rotation.y, rotation.z],
    scale: [scale.x, scale.y, scale.z],
  };
  return hasShear(transform) ? { ...parts, matrix: matrixOfTransform3D(transform) } : parts;
}

/**
 * Spreadable `<group>` transform props: the discrete parts, or a sheared basis' `matrix` with
 * `matrixAutoUpdate=false`, which keeps three.js from recomposing it from an identity position,
 * quaternion and scale.
 */
export function node3dGroupSpread(
  t: NodeTransform
):
  | { position: Vec3Tuple; rotation: Vec3Tuple; scale: Vec3Tuple }
  | { matrix: THREE.Matrix4; matrixAutoUpdate: false } {
  return t.matrix
    ? { matrix: t.matrix, matrixAutoUpdate: false }
    : { position: t.position, rotation: t.rotation, scale: t.scale };
}

export function transformFromNode3DProperties(properties: Node3DProperties): NodeTransform {
  return decomposeForR3F(properties.transform);
}

/**
 * The spread for a Sprite3D or Label3D quad. The billboard and `fixed_size` hooks rewrite its
 * matrix and scale every frame, so a node they pose keeps the discrete parts and a shear drops out.
 */
export function node3dPosedGroupSpread(
  t: NodeTransform,
  { billboard, fixed_size }: { billboard: number; fixed_size: boolean }
): ReturnType<typeof node3dGroupSpread> {
  const isPosedPerFrame = fixed_size || billboard !== BillboardMode.BILLBOARD_DISABLED;
  return node3dGroupSpread(isPosedPerFrame ? { ...t, matrix: undefined } : t);
}
