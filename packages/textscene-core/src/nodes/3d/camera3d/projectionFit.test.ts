import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitToAspect, fittedAspect, setLens } from './projectionFit';
import { KeepAspectMode } from './types';
import { radToDeg } from '../../../godot/math/math';

function orthographic(size: number, keepAspect: KeepAspectMode) {
  const camera = new THREE.OrthographicCamera();
  setLens(camera, { fov: 75, size, keepAspect });
  return camera;
}

function perspective(fov: number, keepAspect: KeepAspectMode) {
  const camera = new THREE.PerspectiveCamera();
  setLens(camera, { fov, size: 1, keepAspect });
  return camera;
}

describe('fitToAspect', () => {
  it('frames `size` vertically under KEEP_HEIGHT, as `Projection::set_orthogonal` does', () => {
    const camera = orthographic(8, KeepAspectMode.KEEP_HEIGHT);
    fitToAspect(camera, 2);
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-8, 8, 4, -4]);
  });

  it('frames `size` horizontally under KEEP_WIDTH', () => {
    const camera = orthographic(8, KeepAspectMode.KEEP_WIDTH);
    fitToAspect(camera, 2);
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-4, 4, 2, -2]);
  });

  it('rebuilds the projection matrix, which three leaves at the constructor frustum', () => {
    const camera = orthographic(8, KeepAspectMode.KEEP_HEIGHT);
    fitToAspect(camera, 1);
    // An orthographic matrix scales y by 2 / (top - bottom).
    expect(camera.projectionMatrix.elements[5]).toBeCloseTo(2 / 8, 6);
  });

  it('keeps a vertical fov under KEEP_HEIGHT', () => {
    const camera = perspective(70, KeepAspectMode.KEEP_HEIGHT);
    fitToAspect(camera, 1.6);
    expect(camera.fov).toBe(70);
    expect(camera.aspect).toBe(1.6);
  });

  it('turns a horizontal fov into a vertical one at the new aspect under KEEP_WIDTH', () => {
    const camera = perspective(90, KeepAspectMode.KEEP_WIDTH);
    fitToAspect(camera, 2);
    // tan(fovy / 2) = tan(45°) / 2.
    expect(camera.fov).toBeCloseTo(radToDeg(Math.atan(0.5) * 2), 6);
  });

  it('leaves a camera with no lens unchanged (edge case)', () => {
    const camera = new THREE.PerspectiveCamera(50, 1);
    fitToAspect(camera, 2);
    expect(camera.aspect).toBe(1);
  });
});

describe('fittedAspect', () => {
  it('reads the aspect of the last fit', () => {
    const camera = orthographic(2, KeepAspectMode.KEEP_HEIGHT);
    fitToAspect(camera, 1.25);
    expect(fittedAspect(camera)).toBe(1.25);
  });

  it('reads nothing for a camera never fitted (error case)', () => {
    expect(fittedAspect(new THREE.OrthographicCamera())).toBeNull();
  });
});
