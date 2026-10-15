import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAPTURE_NEAR } from '../../godot/rendering/environment/reflectionProbe';
import { captureCameras, probeCaptureOf } from './captureCameras';

const SETTINGS = { isInterior: false, hasShadows: true };

/** The world direction `camera` looks along. */
function viewDirection(camera: THREE.Camera): THREE.Vector3 {
  // Adding 0 turns a -0 into 0.
  return new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld).round().addScalar(0);
}

describe('captureCameras', () => {
  it("looks along +X, -X, +Y, -Y, +Z and -Z from the origin offset, in the probe's frame", () => {
    const world = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(10, 0, 0);
    const cameras = captureCameras(world, { x: 0, y: 2, z: 0 }, [1, 1, 1, 1, 1, 1], SETTINGS);

    expect(cameras.map((camera) => viewDirection(camera).toArray())).toEqual([
      [0, 0, -1],
      [0, 0, 1],
      [0, 1, 0],
      [0, -1, 0],
      [1, 0, 0],
      [-1, 0, 0],
    ]);
    expect(new THREE.Vector3().setFromMatrixPosition(cameras[0]!.matrixWorld).toArray()).toEqual([10, 2, 0]);
  });

  it("draws each face with Godot's up, as three's cube cameras do", () => {
    const [px, , py] = captureCameras(
      new THREE.Matrix4(),
      { x: 0, y: 0, z: 0 },
      [1, 1, 1, 1, 1, 1],
      SETTINGS
    );

    expect(new THREE.Vector3(0, 1, 0).transformDirection(px!.matrixWorld).round().toArray()).toEqual([
      0, -1, 0,
    ]);
    expect(new THREE.Vector3(0, 1, 0).transformDirection(py!.matrixWorld).round().toArray()).toEqual([
      0, 0, 1,
    ]);
  });

  it("gives each face a 90-degree square view from Godot's near plane to its own far plane", () => {
    const cameras = captureCameras(new THREE.Matrix4(), { x: 0, y: 0, z: 0 }, [1, 2, 3, 4, 5, 6], SETTINGS);

    expect(cameras.map(({ fov, aspect, near, far }) => [fov, aspect, near, far])).toEqual(
      [1, 2, 3, 4, 5, 6].map((far) => [90, 1, CAPTURE_NEAR, far])
    );
  });

  it("keeps the probe's frame without its scale, as Godot's probe disables it (edge case)", () => {
    const world = new THREE.Matrix4().makeScale(3, 3, 3);
    const [camera] = captureCameras(world, { x: 1, y: 0, z: 0 }, [1, 1, 1, 1, 1, 1], SETTINGS);

    expect(new THREE.Vector3().setFromMatrixPosition(camera!.matrixWorld).x).toBeCloseTo(1, 9);
    expect(new THREE.Vector3(1, 0, 0).transformDirection(camera!.matrixWorld).length()).toBeCloseTo(1, 9);
  });
});

describe('probeCaptureOf', () => {
  it('names the capture a camera draws', () => {
    const settings = { isInterior: true, hasShadows: false };
    const [camera] = captureCameras(new THREE.Matrix4(), { x: 0, y: 0, z: 0 }, [1, 1, 1, 1, 1, 1], settings);

    expect(probeCaptureOf(camera!)).toBe(settings);
  });

  it('is undefined for any other camera (edge case)', () => {
    expect(probeCaptureOf(new THREE.PerspectiveCamera())).toBeUndefined();
  });
});
