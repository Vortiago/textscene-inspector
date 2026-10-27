import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { composeOntoRest, type LocalPose } from './boneRest';

const pose = (position = new THREE.Vector3(), scale = new THREE.Vector3(1, 1, 1)): LocalPose => ({
  position,
  quaternion: new THREE.Quaternion(),
  scale,
});
const emptyPose = () => pose();

describe('composeOntoRest', () => {
  it('places the local pose in the frame of the rest pose', () => {
    const rest = new THREE.Matrix4().makeTranslation(1.5, 0.5, 0);

    const composed = composeOntoRest(rest, pose(new THREE.Vector3(0, 1.5, 0)), emptyPose());

    expect(composed.position.toArray()).toEqual([1.5, 2, 0]);
  });

  it('multiplies the scale of the rest pose by the local scale', () => {
    const rest = new THREE.Matrix4().makeScale(2, 2, 2);

    const composed = composeOntoRest(rest, pose(undefined, new THREE.Vector3(1, 2, 3)), emptyPose());

    expect(composed.scale.toArray()).toEqual([2, 4, 6]);
  });
});
