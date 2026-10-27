/**
 * The one way a transform written to a node Godot makes a bone lands on it. The object holds the
 * rest pose in its own transform (`godotBoneRest`), and Godot gives the node an identity transform
 * below its BoneAttachment3D, so a write, an override or a track value is relative to that pose.
 */

import * as THREE from 'three';

/** The three parts of a local transform. */
export interface LocalPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

const _local = new THREE.Matrix4();

/**
 * Writes `rest` times `local` into `out`. A part of `local` that a track does not drive stays at
 * its identity, so one value of a track composes through the same product as a whole override.
 *
 * @oneWay A transform written to a node Godot makes a bone, composed onto its rest pose
 */
export function composeOntoRest(rest: THREE.Matrix4, local: LocalPose, out: LocalPose): LocalPose {
  _local.compose(local.position, local.quaternion, local.scale);
  _local.premultiply(rest).decompose(out.position, out.quaternion, out.scale);
  return out;
}
