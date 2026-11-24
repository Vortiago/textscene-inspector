/**
 * Which camera a sub-viewport renders through and how its target is framed, asserted without R3F.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import {
  frameOverView,
  applyOrthoFrame,
  godotCanvasPlacement,
  orthoFrameForCamera2D,
  orthoFrameForSize,
  cameraAtPath,
  camera2DAtPath,
  viewportAspect,
} from './viewportFraming';
import type { Camera2DTag } from './camera2DView';
import { markCanvasFrame } from '../canvasFrame';

import { Camera2DAnchorMode } from '../../godot/scene/camera2d';

/** A camera tagged the way `<Camera3D>` tags one: its dispatcher-absolute path. */
function camera(tscnPath: string): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera();
  cam.userData.tscnPath = tscnPath;
  return cam;
}

/**
 * A group tagged the way `<Camera2D>` tags one. Defaults mirror Godot's: zoom 1,
 * no offset, DRAG_CENTER, enabled, and the +/-10000000 "unlimited" limits.
 */
function camera2d(overrides: Partial<Camera2DTag> = {}, tscnPath = 'Root/Camera2D'): THREE.Object3D {
  const group = new THREE.Object3D();
  group.userData.tscnPath = tscnPath;
  group.userData.camera2d = {
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
  } satisfies Camera2DTag;
  return group;
}

/** Read a tagged group's payload back out, the way the offscreen pass does. */
function tagOf(object: THREE.Object3D): Camera2DTag {
  return object.userData.camera2d as Camera2DTag;
}

describe('cameraAtPath', () => {
  it('finds the camera tagged with the path', () => {
    const scene = new THREE.Scene();
    const mine = camera('Root/SubViewport/Camera3D');
    scene.add(camera('Root/OtherCamera'), mine);
    expect(cameraAtPath(scene, 'Root/SubViewport/Camera3D')).toBe(mine);
  });

  it('is null before the camera mounts', () => {
    expect(cameraAtPath(new THREE.Scene(), 'Root/SubViewport/Camera3D')).toBeNull();
  });

  it('is null for a viewport with no current camera', () => {
    const scene = new THREE.Scene();
    scene.add(camera('Root/SubViewport/Camera3D'));
    expect(cameraAtPath(scene, null)).toBeNull();
  });

  /** An untagged THREE camera (a helper, the editor camera) is not a scene camera. */
  it('ignores cameras carrying no tscnPath tag', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.PerspectiveCamera());
    expect(cameraAtPath(scene, 'Root/SubViewport/Camera3D')).toBeNull();
  });
});

describe('camera2DAtPath', () => {
  it('finds the Camera2D group tagged with the path', () => {
    const scene = new THREE.Scene();
    const mine = camera2d({}, 'Root/Sub/Mine');
    scene.add(camera2d({}, 'Root/Sub/Other'), mine);
    expect(camera2DAtPath(scene, 'Root/Sub/Mine')).toBe(mine);
  });

  it('is null for a viewport with no current Camera2D', () => {
    const scene = new THREE.Scene();
    scene.add(camera2d({}, 'Root/Sub/Mine'));
    expect(camera2DAtPath(scene, null)).toBeNull();
  });

  it('ignores an object with the path that carries no camera2d tag', () => {
    const scene = new THREE.Scene();
    const plain = new THREE.Object3D();
    plain.userData.tscnPath = 'Root/Sub/Mine';
    scene.add(plain);
    expect(camera2DAtPath(scene, 'Root/Sub/Mine')).toBeNull();
  });
});

describe('orthoFrameForCamera2D', () => {
  /** DRAG_CENTER (Godot's default) centres the view rect on the camera. */
  it('centres the view on the camera position', () => {
    const frame = orthoFrameForCamera2D(tagOf(camera2d()), { x: 400, y: 300 }, { x: 200, y: 100 });
    expect(frame.left).toBe(-100);
    expect(frame.right).toBe(100);
    expect(frame.top).toBe(50);
    expect(frame.bottom).toBe(-50);
    // Godot y is negated into three space, as `orthoFrameForSize` does.
    expect(frame.position).toEqual([400, -300, 1000]);
  });

  /** Higher zoom is closer, so the view rect covers fewer canvas pixels. */
  it('shrinks the view rect as zoom magnifies', () => {
    const frame = orthoFrameForCamera2D(
      tagOf(camera2d({ zoom: { x: 2, y: 2 } })),
      { x: 0, y: 0 },
      { x: 400, y: 200 }
    );
    expect(frame.right - frame.left).toBe(200);
    expect(frame.top - frame.bottom).toBe(100);
  });

  /**
   * A Camera2D at world (100, 608.5), offset (0, 50), limits [-715, -250, 1425, 690],
   * in a 399x480 sub-viewport. The view would run to y = 848.5, past `limit_bottom`
   * 690, so Godot clamps the rect to top 210, and the centre is 210 + 240 + 50 = 500,
   * the rect Godot 4.6 frames.
   */
  it('clamps the view rect into the scroll limits before adding offset', () => {
    const frame = orthoFrameForCamera2D(
      tagOf(
        camera2d({
          offset: { x: 0, y: 50 },
          limitLeft: -715,
          limitTop: -250,
          limitRight: 1425,
          limitBottom: 690,
        })
      ),
      { x: 100, y: 608.5 },
      { x: 399, y: 480 }
    );
    expect(frame.position).toEqual([100, -500, 1000]);
    expect(frame.right - frame.left).toBe(399);
    expect(frame.top - frame.bottom).toBe(480);
  });

  /**
   * Offset is added after the clamp, so "the offsetted camera can go past the
   * limits". The same camera with no offset sits 50 canvas pixels higher.
   */
  it('applies offset after the clamp, so the view may leave the limits', () => {
    const clamped = orthoFrameForCamera2D(
      tagOf(camera2d({ limitTop: -250, limitBottom: 690 })),
      { x: 100, y: 608.5 },
      { x: 399, y: 480 }
    );
    expect(clamped.position[1]).toBe(-450);
  });

  /** FIXED_TOP_LEFT puts the camera at the view's top-left corner. */
  it('anchors the view at the camera for FIXED_TOP_LEFT', () => {
    const frame = orthoFrameForCamera2D(
      tagOf(camera2d({ anchor_mode: Camera2DAnchorMode.FIXED_TOP_LEFT })),
      { x: 0, y: 0 },
      { x: 200, y: 100 }
    );
    expect(frame.position).toEqual([100, -50, 1000]);
  });

  /** A degenerate target must not produce a NaN projection. */
  it('stays finite for a degenerate size', () => {
    const frame = orthoFrameForCamera2D(tagOf(camera2d()), { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(Number.isFinite(frame.left)).toBe(true);
    expect(Number.isFinite(frame.top)).toBe(true);
    expect(frame.position.every(Number.isFinite)).toBe(true);
  });
});

describe('godotCanvasPlacement', () => {
  /** `node2dTransform` conjugates by diag(1,-1,1): Godot (100,50) is three (100,-50). */
  it('negates Y back out of three space', () => {
    const object = new THREE.Object3D();
    object.position.set(100, -50, 0);
    object.updateMatrixWorld(true);
    expect(godotCanvasPlacement(object)).toEqual({ x: 100, y: 50, rotation: 0 });
  });

  /**
   * The reason the pass reads the world matrix instead of walking the parsed
   * tree: a Camera2D inside an instanced sub-scene composes its ancestors' 2D
   * transforms for free.
   */
  it("reads a camera under a CanvasLayer in its layer's canvas, without the layer or its anchor", () => {
    const anchor = new THREE.Object3D();
    anchor.position.set(-60, 40, 0);
    const frame = new THREE.Object3D();
    frame.position.set(500, -200, 0);
    markCanvasFrame(frame);
    const camera = new THREE.Object3D();
    camera.position.set(60, -40, 0);
    anchor.add(frame);
    frame.add(camera);
    anchor.updateMatrixWorld(true);
    expect(godotCanvasPlacement(camera)).toEqual({ x: 60, y: 40, rotation: 0 });
  });

  it("reads the global rotation in Godot's sense, clockwise on screen", () => {
    const parent = new THREE.Object3D();
    parent.rotation.z = -0.3;
    const camera = new THREE.Object3D();
    camera.rotation.z = -0.1;
    parent.add(camera);
    parent.updateMatrixWorld(true);
    expect(godotCanvasPlacement(camera).rotation).toBeCloseTo(0.4);
  });

  it('composes an instanced ancestor transform', () => {
    const player = new THREE.Object3D();
    player.position.set(100, -636.5, 0);
    const cam = new THREE.Object3D();
    cam.position.set(0, 28, 0);
    player.add(cam);
    player.updateMatrixWorld(true);
    expect(godotCanvasPlacement(cam)).toEqual({ x: 100, y: 608.5, rotation: 0 });
  });
});

describe('applyOrthoFrame', () => {
  it('turns the camera opposite to a Camera2D view rotation, since three is +Y up', () => {
    const cam = new THREE.OrthographicCamera();
    const turned = tagOf(camera2d({ ignoreRotation: false }));
    applyOrthoFrame(cam, orthoFrameForCamera2D(turned, { x: 0, y: 0, rotation: 0.4 }, { x: 300, y: 200 }));
    expect(cam.rotation.z).toBeCloseTo(-0.4);
  });

  it('applies the frustum and position to the camera', () => {
    const cam = new THREE.OrthographicCamera();
    applyOrthoFrame(cam, orthoFrameForSize({ x: 300, y: 200 }));
    expect([cam.left, cam.right, cam.top, cam.bottom]).toEqual([-150, 150, 100, -100]);
    expect(cam.position.toArray()).toEqual([150, -100, 1000]);
  });

  /**
   * The pass recomputes a frame every rendered frame. A static scene must not
   * pay for a projection-matrix rebuild each time.
   */
  it('rebuilds the projection matrix only when the frustum moved', () => {
    const cam = new THREE.OrthographicCamera();
    const frame = orthoFrameForSize({ x: 300, y: 200 });
    applyOrthoFrame(cam, frame);

    const spy = vi.spyOn(cam, 'updateProjectionMatrix');
    applyOrthoFrame(cam, orthoFrameForSize({ x: 300, y: 200 }));
    expect(spy).not.toHaveBeenCalled();

    applyOrthoFrame(cam, orthoFrameForSize({ x: 320, y: 200 }));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  /** A camera that only pans still needs its new position, matrix rebuild or not. */
  it('moves the camera even when the frustum is unchanged', () => {
    const cam = new THREE.OrthographicCamera();
    const size = { x: 200, y: 100 };
    applyOrthoFrame(cam, orthoFrameForCamera2D(tagOf(camera2d()), { x: 0, y: 0 }, size));
    applyOrthoFrame(cam, orthoFrameForCamera2D(tagOf(camera2d()), { x: 40, y: 10 }, size));
    expect(cam.position.toArray()).toEqual([40, -10, 1000]);
  });
});

describe('viewportAspect', () => {
  it('is the target rect ratio, not the canvas ratio', () => {
    expect(viewportAspect({ x: 256, y: 256 })).toBe(1);
    expect(viewportAspect({ x: 300, y: 150 })).toBe(2);
  });

  /** A zero-area size would produce a NaN/Infinity projection matrix. */
  it('falls back to 1 for a degenerate size rather than dividing by zero', () => {
    expect(viewportAspect({ x: 256, y: 0 })).toBe(1);
    expect(viewportAspect({ x: 0, y: 0 })).toBe(1);
  });
});

describe('orthoFrameForSize', () => {
  /**
   * CanvasItem content lays out against the target rect in Godot pixels with
   * the origin top-left and +Y down. The previewer negates Y
   * (`node2dTransform`), so the rect occupies x ∈ [0, w], y ∈ [-h, 0].
   */
  it('frames exactly the target rect, centred on it', () => {
    const frame = orthoFrameForSize({ x: 300, y: 200 });
    expect(frame.left).toBe(-150);
    expect(frame.right).toBe(150);
    expect(frame.top).toBe(100);
    expect(frame.bottom).toBe(-100);
    expect(frame.position).toEqual([150, -100, 1000]);
  });

  it('stays finite for a degenerate size', () => {
    const frame = orthoFrameForSize({ x: 0, y: 0 });
    expect(Number.isFinite(frame.left)).toBe(true);
    expect(Number.isFinite(frame.top)).toBe(true);
  });
});

describe('frameOverView', () => {
  it('keeps a frame whose view is its layout', () => {
    const frame = orthoFrameForSize({ x: 120, y: 80 });
    expect(frameOverView(frame, { x: 120, y: 80 }, { x: 120, y: 80 })).toBe(frame);
  });

  it('grows a frame about its top-left corner to the canvas units the target shows', () => {
    const framed = frameOverView(orthoFrameForSize({ x: 120, y: 60 }), { x: 120, y: 60 }, { x: 240, y: 120 });
    const [cx, cy] = framed.position;
    // World edges: x from 0 to 240, y from 0 down to -120.
    expect([cx + framed.left, cx + framed.right, cy + framed.top, cy + framed.bottom]).toEqual([
      0, 240, 0, -120,
    ]);
  });

  it('shows the whole view of a 2D override with a zero axis, which frames as one pixel', () => {
    const framed = frameOverView(orthoFrameForSize({ x: 128, y: 0 }), { x: 128, y: 0 }, { x: 512, y: 300 });
    const [cx, cy] = framed.position;
    expect([cx + framed.left, cx + framed.right, cy + framed.top, cy + framed.bottom]).toEqual([
      0, 512, 0, -300,
    ]);
  });
});
