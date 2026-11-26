import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { World2DCamera, world2DCameraPose } from '../components/Canvas2DStage/world2DCamera';
import type { Transform2DColumns } from '../../godot/math/transform2d';
import { mutableTransform2D } from '../../godot/math/transform2d';
import { canvasDataTransformInto, targetViewportInto } from './canvasTransforms';
import type { TargetViewport } from '../../shaders/canvas/canvasBindings';

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

const rounded = (values: Transform2DColumns | TargetViewport) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]: [string, number]) => [key, Math.round(value * 1e6) / 1e6 + 0])
  );

describe('canvasDataTransformInto', () => {
  it('is the identity for an unpanned, unzoomed stage on the root canvas', () => {
    expect(
      rounded(canvasDataTransformInto(mutableTransform2D(), stageCamera({ x: 0, y: 0 }, 1), null, STAGE))
    ).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: 0,
      ty: 0,
    });
  });

  it('scales by the zoom and moves by the pan, as a canvas pixel lands at pan + p * zoom', () => {
    expect(
      rounded(canvasDataTransformInto(mutableTransform2D(), stageCamera({ x: 10, y: 20 }, 2), null, STAGE))
    ).toEqual({
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

    expect(
      rounded(canvasDataTransformInto(mutableTransform2D(), stageCamera({ x: 0, y: 0 }, 1), frame, STAGE))
    ).toMatchObject({
      tx: 30,
      ty: 40,
    });
  });
});

describe('targetViewportInto', () => {
  const scratch = (): TargetViewport => ({ x: 0, y: 0, width: 0, height: 0, scale: 0 });

  it("places Godot's viewport where the stage camera shows world (0, 0), at the zoom", () => {
    const camera = stageCamera({ x: 10, y: 20 }, 2);
    camera.viewportSize = { x: 1152, y: 648 };

    expect(rounded(targetViewportInto(scratch(), camera, STAGE)!)).toEqual({
      x: 10,
      y: 20,
      width: 1152,
      height: 648,
      scale: 2,
    });
  });

  it("gives the whole target for a pass camera, which shows no viewport of Godot's", () => {
    expect(targetViewportInto(scratch(), stageCamera({ x: 10, y: 20 }, 2), STAGE)).toBeUndefined();
  });

  it('gives the whole target for a camera that is not the 2D world camera', () => {
    const camera = new THREE.OrthographicCamera();

    expect(targetViewportInto(scratch(), camera, STAGE)).toBeUndefined();
  });
});
