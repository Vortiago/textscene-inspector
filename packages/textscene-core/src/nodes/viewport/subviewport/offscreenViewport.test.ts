/**
 * The pure half of the offscreen-render subsystem: which camera a sub-viewport
 * renders through, how its target is framed, and how target pixels become
 * `ImageData`. Kept free of R3F so the rules are asserted directly rather than
 * inferred from a mounted tree.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  DEFAULT_CLEAR_COLOR,
  orthoFrameForSize,
  selectViewportCamera,
  targetPixelsToImageData,
  viewportAspect,
} from './offscreenViewport';

/** A camera tagged the way `<Camera3D>` tags one: its dispatcher-absolute path. */
function camera(tscnPath: string, current = false): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera();
  cam.userData.tscnPath = tscnPath;
  cam.userData.tscnCurrent = current;
  return cam;
}

describe('selectViewportCamera', () => {
  /**
   * Godot renders a viewport through a Camera3D **inside** it:
   * `scene/3d/camera_3d.cpp`, `Camera3D::_notification` /
   * `NOTIFICATION_ENTER_WORLD`, does `viewport = get_viewport();` then
   * `viewport->_camera_3d_add(this)` — `get_viewport()` being the nearest
   * Viewport ancestor. A camera elsewhere in the shared World3D belongs to a
   * different viewport and must not be picked, which matters here because the
   * shared-world render source is the WHOLE main scene.
   */
  it('picks a camera that is a descendant of the sub-viewport', () => {
    const scene = new THREE.Scene();
    const mine = camera('Root/SubViewport/Camera3D');
    scene.add(camera('Root/OtherCamera'), mine);
    expect(selectViewportCamera(scene, 'Root/SubViewport')).toBe(mine);
  });

  it('ignores a camera outside the sub-viewport entirely', () => {
    const scene = new THREE.Scene();
    scene.add(camera('Root/OtherCamera'));
    expect(selectViewportCamera(scene, 'Root/SubViewport')).toBeNull();
  });

  /**
   * A path prefix is only a descendant when the next character is a separator —
   * `Root/SubViewportExtra/Camera3D` is a sibling, not a child.
   */
  it('does not mistake a sibling with a shared name prefix for a descendant', () => {
    const scene = new THREE.Scene();
    scene.add(camera('Root/SubViewportExtra/Camera3D'));
    expect(selectViewportCamera(scene, 'Root/SubViewport')).toBeNull();
  });

  /**
   * `camera_3d.cpp`, `NOTIFICATION_ENTER_WORLD`:
   * `if (current || first_camera) { viewport->_camera_3d_set(this); }`
   * — a camera marked `current` claims the viewport whatever the tree order.
   */
  it('prefers a camera with current = true over an earlier sibling', () => {
    const scene = new THREE.Scene();
    const first = camera('Root/SubViewport/CameraA');
    const current = camera('Root/SubViewport/CameraB', true);
    scene.add(first, current);
    expect(selectViewportCamera(scene, 'Root/SubViewport')).toBe(current);
  });

  /**
   * `Viewport::_camera_3d_set` replaces the incumbent unconditionally (it only
   * early-returns when the camera is ALREADY the current one), so when several
   * cameras are marked `current` the LAST to enter the tree keeps it — not the
   * first. Reading the rule as "first current wins" is the natural mistake.
   */
  it('with several current cameras the last in tree order wins', () => {
    const scene = new THREE.Scene();
    const earlier = camera('Root/SubViewport/CameraA', true);
    const later = camera('Root/SubViewport/CameraB', true);
    scene.add(earlier, later);
    expect(selectViewportCamera(scene, 'Root/SubViewport')).toBe(later);
  });

  /**
   * With none marked current, `first_camera` (`_camera_3d_add` returning
   * "set size is now 1") elects the first camera to enter the tree.
   */
  it('falls back to the first camera in tree order', () => {
    const scene = new THREE.Scene();
    const first = camera('Root/SubViewport/CameraA');
    scene.add(first, camera('Root/SubViewport/CameraB'));
    expect(selectViewportCamera(scene, 'Root/SubViewport')).toBe(first);
  });

  it('returns null for an empty scene rather than throwing', () => {
    expect(selectViewportCamera(new THREE.Scene(), 'Root/SubViewport')).toBeNull();
  });

  /** An untagged THREE camera (a helper, the editor camera) is not a scene camera. */
  it('ignores cameras carrying no tscnPath tag', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.PerspectiveCamera());
    expect(selectViewportCamera(scene, 'Root/SubViewport')).toBeNull();
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
   * the origin top-left and +Y down; the previewer negates Y
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

describe('targetPixelsToImageData', () => {
  /**
   * `WebGLRenderer.readRenderTargetPixels` returns rows bottom-up (GL's origin
   * is bottom-left); `ImageData` is top-down. Without the flip every DOM
   * consumer paints the target upside down, and no golden in this repo would
   * show it on a vertically symmetric scene.
   */
  it('flips GL bottom-up rows into top-down ImageData rows', () => {
    // 1x2: bottom row red, top row blue, as GL would hand them over.
    const pixels = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]);
    const image = targetPixelsToImageData(pixels, 1, 2);
    expect(image).not.toBeNull();
    // Top-down: the first ImageData row must be the GL LAST row (blue).
    expect(Array.from(image!.data.slice(0, 4))).toEqual([0, 0, 255, 255]);
    expect(Array.from(image!.data.slice(4, 8))).toEqual([255, 0, 0, 255]);
  });

  it('returns null when the buffer does not match the stated rect', () => {
    expect(targetPixelsToImageData(new Uint8Array(4), 4, 4)).toBeNull();
  });

  it('returns null for a zero-area rect rather than constructing an empty ImageData', () => {
    expect(targetPixelsToImageData(new Uint8Array(0), 0, 0)).toBeNull();
  });
});

describe('DEFAULT_CLEAR_COLOR', () => {
  /**
   * `servers/rendering/renderer_viewport.cpp` picks the clear colour:
   * `Color bgcolor = p_viewport->transparent_bg ? Color(0, 0, 0, 0) :
   * RSG::texture_storage->get_default_clear_color();`, and `main/main.cpp`
   * seeds that with
   * `GLOBAL_DEF_BASIC("rendering/environment/defaults/default_clear_color",
   * Color(0.3, 0.3, 0.3))`.
   *
   * A Godot 4.6.3 render of an uncovered opaque target measures
   * rgb(77, 77, 77) — so the 0.3 is the **sRGB** component, not a linear one.
   * `new THREE.Color(0.3, 0.3, 0.3)` sets the working (linear) space instead
   * and would clear to about rgb(149); only a probe would ever catch that.
   */
  it('is the sRGB colour that renders as rgb(77, 77, 77)', () => {
    const srgb = DEFAULT_CLEAR_COLOR.clone();
    const out = { r: 0, g: 0, b: 0 };
    srgb.getRGB(out, THREE.SRGBColorSpace);
    expect(Math.round(out.r * 255)).toBe(77);
    expect(Math.round(out.g * 255)).toBe(77);
    expect(Math.round(out.b * 255)).toBe(77);
  });
});
