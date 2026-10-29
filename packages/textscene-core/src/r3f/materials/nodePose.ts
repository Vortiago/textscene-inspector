/**
 * The node's pose in a program that reads it. Godot's MODEL_MATRIX is the node's, which a
 * billboard or `fixed_size` never moves, while three draws such a surface with a moved
 * `modelMatrix`. The draw hooks write both maps between the two before each draw.
 */

import * as THREE from 'three';

/** The uniforms of one material's node pose, each the identity where three draws in the node's pose. */
export interface NodePoseUniforms {
  /** From three's model space to the node's object space. */
  godotObjectFromModel: THREE.IUniform<THREE.Matrix4>;
  /** From the node's object space to three's model space. */
  godotModelFromObject: THREE.IUniform<THREE.Matrix4>;
}

/**
 * The declarations, guarded, so a program that two patches give the pose declares it once.
 *
 * @canonical The node's pose in a program
 */
export const NODE_POSE_PARS = /* glsl */ `#ifndef GODOT_NODE_POSE
#define GODOT_NODE_POSE
uniform mat4 godotObjectFromModel;
uniform mat4 godotModelFromObject;
#endif
`;

/**
 * Each material's pose uniforms. Created by the first program that reads them, written by
 * `alignNodePose` before each draw, and collected with the material.
 */
// eslint-disable-next-line no-restricted-syntax -- alignNodePose reads an entry without building one, and a perObject read always builds
const poses = new WeakMap<THREE.Material, NodePoseUniforms>();

/**
 * The pose uniforms of `material`, one pair across its programs and recompiles.
 *
 * @canonical The node's pose in a program
 */
export function nodePoseUniforms(material: THREE.Material): NodePoseUniforms {
  let pose = poses.get(material);
  if (!pose) {
    pose = {
      godotObjectFromModel: { value: new THREE.Matrix4() },
      godotModelFromObject: { value: new THREE.Matrix4() },
    };
    poses.set(material, pose);
  }
  return pose;
}

/**
 * Points `material`'s next draw at the node's pose: `nodeMatrixWorld` is the node's model as Godot
 * holds it, and `modelMatrix` the one three draws with. A material whose programs read no pose is
 * left alone.
 */
export function alignNodePose(
  material: THREE.Material,
  nodeMatrixWorld: THREE.Matrix4,
  modelMatrix: THREE.Matrix4
): void {
  const pose = poses.get(material);
  if (!pose) return;
  if (modelMatrix.equals(nodeMatrixWorld)) {
    pose.godotObjectFromModel.value.identity();
    pose.godotModelFromObject.value.identity();
    return;
  }
  pose.godotObjectFromModel.value.copy(nodeMatrixWorld).invert().multiply(modelMatrix);
  pose.godotModelFromObject.value.copy(modelMatrix).invert().multiply(nodeMatrixWorld);
}
