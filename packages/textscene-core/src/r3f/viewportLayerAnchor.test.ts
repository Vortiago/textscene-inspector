import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyOrthoFrame, orthoFrameForCamera2D, orthoFrameForSize } from './viewportRender/viewportFraming';
import type { Camera2DTag } from './viewportRender/camera2DView';

import { canvasLayerAnchor } from './viewportLayerAnchor';
import type { WorldRender } from './viewportRender/worldRender';
import { rootViewportDescription } from './viewportRender/viewportDescription';
import { Camera2DAnchorMode } from '../godot/scene/camera2d';

const NOT_FOLLOWING = { enabled: false, scale: 1 };

const SIZE = { x: 300, y: 200 };

/** A SubViewport's 2D pass that shows `canvasView` canvas units, or a render with no canvas. */
function canvasRender(canvasView: { x: number; y: number } | null): WorldRender {
  return { viewport: rootViewportDescription(null), shadowAtlas: null, canvasView };
}

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
    ignoreRotation: true,
    enabled: true,
    ...overrides,
  };
}

describe('canvasLayerAnchor for a layer that does not follow', () => {
  it('is the identity over the whole-rect view a pass without a Camera2D draws', () => {
    const anchor = canvasLayerAnchor(
      NOT_FOLLOWING,
      camera(orthoFrameForSize(SIZE)),
      canvasRender(SIZE),
      new THREE.Matrix4()
    );
    expect(anchor.equals(new THREE.Matrix4())).toBe(true);
  });

  it("puts the layer's origin at the top-left of a Camera2D's view", () => {
    // The camera at (500, 400) views world x 350..650, y 300..500.
    const frame = orthoFrameForCamera2D(tag(), { x: 500, y: 400 }, SIZE);
    const anchor = canvasLayerAnchor(NOT_FOLLOWING, camera(frame), canvasRender(SIZE), new THREE.Matrix4());
    expect(landing(anchor, { x: 0, y: 0 })).toEqual({ x: 350, y: 300 });
    expect(landing(anchor, { x: 300, y: 200 })).toEqual({ x: 650, y: 500 });
  });

  it("turns the layer with a turned Camera2D's view, so it stays on the screen", () => {
    const turned = tag({ ignoreRotation: false });
    const frame = orthoFrameForCamera2D(turned, { x: 500, y: 400, rotation: Math.PI / 2 }, SIZE);
    const anchor = canvasLayerAnchor(NOT_FOLLOWING, camera(frame), canvasRender(SIZE), new THREE.Matrix4());
    const corner = landing(anchor, { x: 0, y: 0 });
    expect([corner.x, corner.y].map(Math.round)).toEqual([600, 250]);
  });

  it("keeps a layer unit one canvas unit under a zoomed Camera2D's view", () => {
    const frame = orthoFrameForCamera2D(tag({ zoom: { x: 2, y: 2 } }), { x: 500, y: 400 }, SIZE);
    const anchor = canvasLayerAnchor(NOT_FOLLOWING, camera(frame), canvasRender(SIZE), new THREE.Matrix4());
    expect(landing(anchor, { x: 0, y: 0 })).toEqual({ x: 425, y: 350 });
    expect(landing(anchor, { x: 300, y: 200 })).toEqual({ x: 575, y: 450 });
  });
});

describe('canvasLayerAnchor', () => {
  const stage = { x: 1152, y: 648 };

  it('keeps a layer unit one canvas unit in a stretched pass, so the stretch scales the layer too', () => {
    // A 1152 x 648 canvas stretched over a 1728 x 972 target: the camera frames the canvas.
    const anchor = canvasLayerAnchor(
      NOT_FOLLOWING,
      camera(orthoFrameForSize(stage)),
      canvasRender(stage),
      new THREE.Matrix4()
    );
    expect(landing(anchor, { x: 400, y: 300 })).toEqual({ x: 400, y: 300 });
  });

  it('is the identity in a render that draws no canvas through a canvas transform', () => {
    const anchor = canvasLayerAnchor(
      NOT_FOLLOWING,
      camera(orthoFrameForSize(stage)),
      canvasRender(null),
      new THREE.Matrix4().makeScale(2, 2, 1)
    );
    expect(anchor.equals(new THREE.Matrix4())).toBe(true);
  });
});
