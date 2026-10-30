/**
 * Writes a GLB node's transform from a scene's override.
 */
import * as THREE from 'three';
import { node3dGroupSpread, type NodeTransform } from '../../nodeTransform';
import { composeOntoRest } from '../../../resources/formats/glb/boneRest';
import { godotBoneRest } from '../../../resources/formats/glb/godotNodes';

/**
 * Writes `transform` as the local transform of `target`. A node Godot makes a bone holds the glTF
 * transform as the bone's rest pose, so its own transform composes onto that pose and a shear
 * drops out, as a bone pose holds none. Any other node keeps a shear through its `updateMatrix`.
 */
export function writeNodeTransform(target: THREE.Object3D, transform: NodeTransform): void {
  const { position, rotation, scale } = transform;
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
    target.updateMatrix = node3dGroupSpread(transform).updateMatrix;
  }
  target.updateMatrix();
}
