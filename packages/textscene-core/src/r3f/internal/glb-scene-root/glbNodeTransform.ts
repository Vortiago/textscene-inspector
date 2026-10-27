/**
 * Writes a GLB node's transform from a scene's override.
 */
import * as THREE from 'three';
import type { NodeTransform } from '../../nodeTransform';
import { godotBoneRest } from '../../../resources/formats/glb/godotNodes';

/**
 * Writes `transform` as the local transform of `target`. A node Godot makes a bone holds the glTF
 * transform as the bone's rest pose, so its own transform composes onto that pose.
 */
export function writeNodeTransform(
  target: THREE.Object3D,
  { position, rotation, scale }: NodeTransform
): void {
  const rest = godotBoneRest(target);
  if (rest) {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale)
    );
    rest.multiply(local).decompose(target.position, target.quaternion, target.scale);
  } else {
    target.position.set(...position);
    target.rotation.set(...rotation);
    target.scale.set(...scale);
  }
  target.updateMatrix();
}
