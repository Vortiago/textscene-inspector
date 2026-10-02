import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { lightPoseMatrix, readLightPose } from './lightPose';

/** A light at (1, 2, 3), turned a quarter about Y and scaled, as a node's transform can. */
function turnedLight(): THREE.PointLight {
  const light = new THREE.PointLight();
  light.position.set(1, 2, 3);
  light.rotation.y = Math.PI / 2;
  light.scale.set(2, 3, 4);
  light.updateMatrixWorld();
  return light;
}

describe('readLightPose', () => {
  it('reads the light’s world position and rotation', () => {
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    readLightPose(turnedLight(), position, rotation);
    expect(position.toArray()).toEqual([1, 2, 3]);
    expect(
      rotation.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2))
    ).toBeCloseTo(0, 6);
  });

  it('reads the parent’s transform too (edge case)', () => {
    const parent = new THREE.Group();
    parent.position.set(10, 0, 0);
    const light = new THREE.PointLight();
    parent.add(light);
    parent.updateMatrixWorld();
    const position = new THREE.Vector3();
    readLightPose(light, position, new THREE.Quaternion());
    expect(position.toArray()).toEqual([10, 0, 0]);
  });
});

describe('lightPoseMatrix', () => {
  it('is the light’s world transform without its scale', () => {
    const target = new THREE.Matrix4();
    const pose = lightPoseMatrix(turnedLight(), target);
    expect(pose).toBe(target);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    pose.decompose(position, new THREE.Quaternion(), scale);
    expect(position.toArray()).toEqual([1, 2, 3]);
    expect(scale.x).toBeCloseTo(1, 12);
    expect(scale.y).toBeCloseTo(1, 12);
    expect(scale.z).toBeCloseTo(1, 12);
  });

  it('carries a non-finite transform through as NaN (error case)', () => {
    const light = new THREE.PointLight();
    light.position.set(Number.NaN, 0, 0);
    light.updateMatrixWorld();
    expect(lightPoseMatrix(light, new THREE.Matrix4()).elements[12]).toBeNaN();
  });
});
