import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { World2DCamera, world2DCameraPose } from '../components/Canvas2DStage/world2DCamera';
import { canvasTransformOf } from './canvasTransforms';

const STAGE = { width: 200, height: 100 };

/** The 2D world's camera as R3F frames it: one unit per pixel at zoom 1. */
function stageCamera(pan: { x: number; y: number }, zoom: number): World2DCamera {
  const camera = new World2DCamera();
  Object.assign(camera, { left: -STAGE.width / 2, right: STAGE.width / 2, top: STAGE.height / 2 });
  camera.bottom = -STAGE.height / 2;
  const pose = world2DCameraPose(pan, zoom, STAGE.width, STAGE.height);
  camera.position.set(pose.x, pose.y, 1000);
  camera.zoom = pose.zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

const rounded = (transform: Record<string, number>) =>
  Object.fromEntries(Object.entries(transform).map(([key, value]) => [key, Math.round(value * 1e6) / 1e6 + 0]));

describe('canvasTransformOf', () => {
  it('is the identity for an unpanned, unzoomed stage on the root canvas', () => {
    expect(rounded(canvasTransformOf(stageCamera({ x: 0, y: 0 }, 1), null, STAGE))).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: 0,
      ty: 0,
    });
  });

  it("scales by the zoom and moves by the pan, as a canvas pixel lands at pan + p * zoom", () => {
    expect(rounded(canvasTransformOf(stageCamera({ x: 10, y: 20 }, 2), null, STAGE))).toEqual({
      a: 2,
      b: 0,
      c: 0,
      d: 2,
      tx: 10,
      ty: 20,
    });
  });

  it("takes a CanvasLayer's frame in: its offset moves the canvas down in Godot's pixels", () => {
    const frame = new THREE.Object3D();
    frame.position.set(30, -40, 0);
    frame.updateMatrixWorld();

    expect(rounded(canvasTransformOf(stageCamera({ x: 0, y: 0 }, 1), frame, STAGE))).toMatchObject({
      tx: 30,
      ty: 40,
    });
  });
});
