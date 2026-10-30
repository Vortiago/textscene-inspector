/**
 * Writes a GLB node's transform from a scene's override.
 */
import * as THREE from 'three';
import type { NodeTransform } from '../../nodeTransform';
import { composeOntoRest } from '../../../resources/formats/glb/boneRest';
import { godotBoneRest } from '../../../resources/formats/glb/godotNodes';

/**
 * Writes `transform` as the local transform of `target`. A node Godot makes a bone holds the glTF
 * transform as the bone's rest pose, so its own transform composes onto that pose and a shear
 * drops out, as a bone pose holds none. Any other node takes a sheared basis whole, as the matrix.
 */
export function writeNodeTransform(
  target: THREE.Object3D,
  { position, rotation, scale, matrix }: NodeTransform
): void {
  const rest = godotBoneRest(target);
  if (rest) {
    const local = {
      position: new THREE.Vector3(...position),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      scale: new THREE.Vector3(...scale),
    };
    composeOntoRest(rest, local, target);
  } else if (matrix) {
    target.matrixAutoUpdate = false;
    target.matrix.copy(matrix);
    return;
  } else {
    // A sheared override may have switched it off, and these parts must compose again.
    target.matrixAutoUpdate = true;
    target.position.set(...position);
    target.rotation.set(...rotation);
    target.scale.set(...scale);
  }
  target.updateMatrix();
}
