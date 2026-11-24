import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorControlsHandle } from './EditorControlsHandle';

function handleAt(position: [number, number, number]): EditorControlsHandle {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 4000);
  camera.position.set(...position);
  const handle = new EditorControlsHandle(camera, () => {});
  handle.update();
  return handle;
}

describe('EditorControlsHandle pose', () => {
  it('puts a new handle where the old one left its orbit, projection and clip planes', () => {
    const old = handleAt([4, 3, 8]);
    old.target.set(1, 0, -2);
    old.setFov(40);
    old.toggleProjection();

    const next = handleAt([0, 0, 5]);
    next.setPose(old.pose());

    expect(next.camera.position.distanceTo(old.camera.position)).toBeLessThan(1e-12);
    expect(next.target.toArray()).toEqual([1, 0, -2]);
    expect([next.isOrthographic, next.fovDegrees(), next.camera.near, next.camera.far]).toEqual([
      true,
      40,
      0.05,
      4000,
    ]);
  });

  it('takes the clip planes a framing narrowed', () => {
    const old = handleAt([0, 0, 5]);
    Object.assign(old.camera, { near: 0.5, far: 90 });

    const next = handleAt([0, 0, 5]);
    next.setPose(old.pose());

    expect([next.camera.near, next.camera.far]).toEqual([0.5, 90]);
  });
});
