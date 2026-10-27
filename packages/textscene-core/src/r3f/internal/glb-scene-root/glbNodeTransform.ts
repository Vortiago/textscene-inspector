/**
 * Writes a GLB node's transform from a scene's override.
 */
import * as THREE from 'three';
import type { NodeTransform } from '../../nodeTransform';
import { composeOntoRest } from '../../../resources/formats/glb/boneRest';
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
    const local = {
      position: new THREE.Vector3(...position),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      scale: new THREE.Vector3(...scale),
    };
    composeOntoRest(rest, local, target);
  } else {
    target.position.set(...position);
    target.rotation.set(...rotation);
    target.scale.set(...scale);
  }
  target.updateMatrix();
}
