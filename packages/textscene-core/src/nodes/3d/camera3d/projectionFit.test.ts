import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitToAspect, fittedAspect, setLens, type CameraLens } from './projectionFit';

import { radToDeg } from '../../../godot/math/math';
import { Camera3DKeepAspect, Camera3DProjectionType } from '../../../godot/scene/camera3d';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/** A lens at Godot's Camera3D defaults, with the given properties. */
function lensOf(properties: Partial<CameraLens>): CameraLens {
  return {
    projection: Camera3DProjectionType.PERSPECTIVE,
    fov: 75,
    size: 1,
    keepAspect: Camera3DKeepAspect.KEEP_HEIGHT,
    frustumOffset: { x: 0, y: 0 },
    ...properties,
  };
}

function orthographic(size: number, keepAspect: EnumValue<typeof Camera3DKeepAspect>) {
  const camera = new THREE.OrthographicCamera();
  setLens(camera, lensOf({ projection: Camera3DProjectionType.ORTHOGONAL, size, keepAspect }));
  return camera;
}

function perspective(fov: number, keepAspect: EnumValue<typeof Camera3DKeepAspect>) {
  const camera = new THREE.PerspectiveCamera();
  setLens(camera, lensOf({ fov, keepAspect }));
  return camera;
}

/** A frustum camera with its near plane at 1, where `size` and the offset are measured. */
function frustum(size: number, frustumOffset: { x: number; y: number }) {
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 100);
  setLens(camera, lensOf({ projection: Camera3DProjectionType.FRUSTUM, size, frustumOffset }));
  return camera;
}

describe('fitToAspect', () => {
  it('frames `size` vertically under KEEP_HEIGHT, as `Projection::set_orthogonal` does', () => {
    const camera = orthographic(8, Camera3DKeepAspect.KEEP_HEIGHT);
    fitToAspect(camera, 2);
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-8, 8, 4, -4]);
  });

  it('frames `size` horizontally under KEEP_WIDTH', () => {
    const camera = orthographic(8, Camera3DKeepAspect.KEEP_WIDTH);
    fitToAspect(camera, 2);
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-4, 4, 2, -2]);
  });

  it('rebuilds the projection matrix, which three leaves at the constructor frustum', () => {
    const camera = orthographic(8, Camera3DKeepAspect.KEEP_HEIGHT);
    fitToAspect(camera, 1);
    // An orthographic matrix scales y by 2 / (top - bottom).
    expect(camera.projectionMatrix.elements[5]).toBeCloseTo(2 / 8, 6);
  });

  it('keeps a vertical fov under KEEP_HEIGHT', () => {
    const camera = perspective(70, Camera3DKeepAspect.KEEP_HEIGHT);
    fitToAspect(camera, 1.6);
    expect(camera.fov).toBe(70);
    expect(camera.aspect).toBe(1.6);
  });

  it('turns a horizontal fov into a vertical one at the new aspect under KEEP_WIDTH', () => {
    const camera = perspective(90, Camera3DKeepAspect.KEEP_WIDTH);
    fitToAspect(camera, 2);
    // tan(fovy / 2) = tan(45°) / 2.
    expect(camera.fov).toBeCloseTo(radToDeg(Math.atan(0.5) * 2), 6);
  });

  it('frames `size` by `size × aspect` at the near plane under PROJECTION_FRUSTUM', () => {
    const camera = frustum(2, { x: 0, y: 0 });
    fitToAspect(camera, 2);
    // A frustum matrix scales x by 2n / (r - l) and y by 2n / (t - b).
    expect(camera.projectionMatrix.elements[0]).toBeCloseTo(2 / 4, 6);
    expect(camera.projectionMatrix.elements[5]).toBeCloseTo(2 / 2, 6);
  });

  it('shifts the frustum by `frustum_offset`, as `Projection::set_frustum` does', () => {
    const camera = frustum(2, { x: 0.5, y: 0.25 });
    fitToAspect(camera, 2);
    // (r + l) / (r - l) and (t + b) / (t - b): the planes run from -1.5 to 2.5 and -0.75 to 1.25.
    expect(camera.projectionMatrix.elements[8]).toBeCloseTo(1 / 4, 6);
    expect(camera.projectionMatrix.elements[9]).toBeCloseTo(0.5 / 2, 6);
  });

  it('keeps the frustum through a later rebuild of three’s own projection (edge case)', () => {
    const camera = frustum(2, { x: 0.5, y: 0.25 });
    fitToAspect(camera, 2);
    camera.updateProjectionMatrix();
    expect(camera.projectionMatrix.elements[8]).toBeCloseTo(1 / 4, 6);
  });

  it('leaves a camera with no lens unchanged (edge case)', () => {
    const camera = new THREE.PerspectiveCamera(50, 1);
    fitToAspect(camera, 2);
    expect(camera.aspect).toBe(1);
  });
});

describe('fittedAspect', () => {
  it('reads the aspect of the last fit', () => {
    const camera = orthographic(2, Camera3DKeepAspect.KEEP_HEIGHT);
    fitToAspect(camera, 1.25);
    expect(fittedAspect(camera)).toBe(1.25);
  });

  it('reads nothing for a camera never fitted (error case)', () => {
    expect(fittedAspect(new THREE.OrthographicCamera())).toBeNull();
  });
});

describe('setLens', () => {
  it('keeps the aspect of an earlier fit for the new lens', () => {
    const camera = orthographic(2, Camera3DKeepAspect.KEEP_HEIGHT);
    fitToAspect(camera, 1.5);
    setLens(camera, lensOf({ projection: Camera3DProjectionType.ORTHOGONAL, size: 4 }));
    expect(fittedAspect(camera)).toBe(1.5);
  });

  it('leaves the projection alone until the next fit (edge case)', () => {
    const camera = orthographic(2, Camera3DKeepAspect.KEEP_HEIGHT);
    fitToAspect(camera, 1);
    setLens(camera, lensOf({ projection: Camera3DProjectionType.ORTHOGONAL, size: 4 }));
    expect(camera.top).toBe(1);
  });

  it('records no aspect on a camera never fitted (error case)', () => {
    expect(fittedAspect(orthographic(2, Camera3DKeepAspect.KEEP_HEIGHT))).toBeNull();
  });
});
