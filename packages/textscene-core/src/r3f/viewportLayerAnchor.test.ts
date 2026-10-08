import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  applyOrthoFrame,
  orthoFrameForCamera2D,
  orthoFrameForSize,
} from '../nodes/viewport/subviewport/offscreenViewport';
import type { Camera2DTag } from '../nodes/2d/camera2d/cameraView';
import { Camera2DAnchorMode } from '../nodes/2d/camera2d/types';
import { viewportLayerMatrix } from './viewportLayerAnchor';

const NOT_FOLLOWING = { enabled: false, scale: 1 };

const SIZE = { x: 300, y: 200 };

function camera(frame: Parameters<typeof applyOrthoFrame>[1]): THREE.OrthographicCamera {
  const ortho = new THREE.OrthographicCamera();
  applyOrthoFrame(ortho, frame);
  return ortho;
}

/** Where a layer pixel lands in the world the camera frames, in Godot's y-down pixels. */
function landing(anchor: THREE.Matrix4, pixel: { x: number; y: number }): { x: number; y: number } {
  const world = new THREE.Vector3(pixel.x, -pixel.y, 0).applyMatrix4(anchor);
  return { x: world.x, y: -world.y };
}

function tag(overrides: Partial<Camera2DTag> = {}): Camera2DTag {
  return {
    zoom: { x: 1, y: 1 },
    offset: { x: 0, y: 0 },
    anchor_mode: Camera2DAnchorMode.DRAG_CENTER,
    limitLeft: -10000000,
    limitTop: -10000000,
    limitRight: 10000000,
    limitBottom: 10000000,
    limitEnabled: true,
    enabled: true,
    ...overrides,
  };
}

describe('viewportLayerMatrix for a layer that does not follow', () => {
  it('is the identity over the whole-rect view a pass without a Camera2D draws', () => {
    const anchor = viewportLayerMatrix(
      NOT_FOLLOWING,
      camera(orthoFrameForSize(SIZE)),
      SIZE,
      new THREE.Matrix4()
    );
    expect(anchor.equals(new THREE.Matrix4())).toBe(true);
  });

  it("puts the layer's origin at the top-left of a Camera2D's view", () => {
    // The camera at (500, 400) views world x 350..650, y 300..500.
    const frame = orthoFrameForCamera2D(tag(), { x: 500, y: 400 }, SIZE);
    const anchor = viewportLayerMatrix(NOT_FOLLOWING, camera(frame), SIZE, new THREE.Matrix4());
    expect(landing(anchor, { x: 0, y: 0 })).toEqual({ x: 350, y: 300 });
    expect(landing(anchor, { x: 300, y: 200 })).toEqual({ x: 650, y: 500 });
  });

  it("keeps a layer pixel one viewport pixel under a zoomed Camera2D's view", () => {
    const frame = orthoFrameForCamera2D(tag({ zoom: { x: 2, y: 2 } }), { x: 500, y: 400 }, SIZE);
    const anchor = viewportLayerMatrix(NOT_FOLLOWING, camera(frame), SIZE, new THREE.Matrix4());
    expect(landing(anchor, { x: 0, y: 0 })).toEqual({ x: 425, y: 350 });
    expect(landing(anchor, { x: 300, y: 200 })).toEqual({ x: 575, y: 450 });
  });
});
