/**
 * The factor Godot's `FLAG_FIXED_SIZE` multiplies a quad's model-view basis by
 * (`scene/resources/material.cpp:1357-1381`): the origin's view depth in perspective, and the half height
 * of the orthogonal view in orthogonal.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fixedSizeFactor } from './fixedSizeFactor';

function perspectiveCameraAt(position: [number, number, number]): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
  camera.position.set(...position);
  camera.updateMatrixWorld();
  return camera;
}

describe('fixedSizeFactor', () => {
  it('is the view depth of the origin in perspective', () => {
    expect(fixedSizeFactor(perspectiveCameraAt([0, 0, 10]), new THREE.Vector3(0, 0, 0))).toBeCloseTo(10, 10);
  });

  it('reads the depth along the view axis, not the distance to the camera', () => {
    expect(fixedSizeFactor(perspectiveCameraAt([0, 0, 10]), new THREE.Vector3(3, 4, 0))).toBeCloseTo(10, 10);
  });

  it('is the half height of the orthogonal view in orthogonal, whatever the depth', () => {
    const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld();
    expect([2, 40].map((z) => fixedSizeFactor(camera, new THREE.Vector3(0, 0, 10 - z)))).toEqual([4.5, 4.5]);
  });
});
