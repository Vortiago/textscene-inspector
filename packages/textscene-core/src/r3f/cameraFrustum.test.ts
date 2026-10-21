import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraFrustum } from './cameraFrustum';

function cameraAtOriginLookingDownZ(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld();
  return camera;
}

describe('cameraFrustum', () => {
  it('holds a point in front of the camera', () => {
    const frustum = cameraFrustum(cameraAtOriginLookingDownZ(), new THREE.Frustum());
    expect(frustum.containsPoint(new THREE.Vector3(0, 0, -10))).toBe(true);
  });

  it('leaves out a point behind the camera', () => {
    const frustum = cameraFrustum(cameraAtOriginLookingDownZ(), new THREE.Frustum());
    expect(frustum.containsPoint(new THREE.Vector3(0, 0, 10))).toBe(false);
  });

  it('follows the camera after it moves (edge case)', () => {
    const camera = cameraAtOriginLookingDownZ();
    camera.position.set(0, 0, 20);
    camera.updateMatrixWorld();
    expect(cameraFrustum(camera, new THREE.Frustum()).containsPoint(new THREE.Vector3(0, 0, 10))).toBe(true);
  });
});
