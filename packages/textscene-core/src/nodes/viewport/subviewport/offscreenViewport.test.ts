/**
 * The pure half of the offscreen-render subsystem: which camera a sub-viewport
 * renders through and how its target is framed. Kept free of R3F so the
 * rules are asserted directly rather than inferred from a mounted tree.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import {
  DEFAULT_CLEAR_COLOR,
  applyOrthoFrame,
  createOffscreenTarget,
  godotCanvasPosition,
  orthoFrameForCamera2D,
  orthoFrameForSize,
  selectViewportCamera,
  selectViewportCamera2D,
  viewportAspect,
} from './offscreenViewport';
import type { Camera2DTag } from '../../2d/camera2d/cameraView';
import { Camera2DAnchorMode } from '../../2d/camera2d/types';

/** A camera tagged the way `<Camera3D>` tags one: its dispatcher-absolute path. */
function camera(tscnPath: string, current = false): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera();
  cam.userData.tscnPath = tscnPath;
  cam.userData.tscnCurrent = current;
  return cam;
}

/**
 * A group tagged the way `<Camera2D>` tags one. Defaults mirror Godot's: zoom 1,
 * no offset, DRAG_CENTER, enabled, and the +/-10000000 "unlimited" limits.
 */
function camera2d(overrides: Partial<Camera2DTag> = {}): THREE.Object3D {
  const group = new THREE.Object3D();
  group.userData.camera2d = {
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
  } satisfies Camera2DTag;
  return group;
}

/** Read a tagged group's payload back out, the way the offscreen pass does. */
function tagOf(object: THREE.Object3D): Camera2DTag {
  return object.userData.camera2d as Camera2DTag;
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

describe('selectViewportCamera2D', () => {
  it('picks the enabled Camera2D in the subtree', () => {
    const scene = new THREE.Scene();
    const cam = camera2d();
    scene.add(new THREE.Object3D(), cam);
    expect(selectViewportCamera2D(scene)).toBe(cam);
  });

  /**
   * The crux, and the exact INVERSE of the 3D rule asserted above.
   * `scene/2d/camera_2d.cpp`, `Camera2D::_notification` /
   * `NOTIFICATION_ENTER_TREE`:
   *
   *     if (!_is_editing_in_editor() && enabled && !viewport->get_camera_2d()) {
   *         make_current();
   *     }
   *
   * The `!viewport->get_camera_2d()` guard admits a camera only while the slot
   * is VACANT, so an incumbent is never displaced and the FIRST enabled camera
   * in tree order keeps the viewport. `Camera3D` has no such guard —
   * `Viewport::_camera_3d_set` overwrites — so there the LAST current camera
   * wins. Two Player instances in one SubViewport (`game_splitscreen.tscn`)
   * make the difference a visible change of framing, not a technicality.
   */
  it('with several Camera2Ds the FIRST in tree order wins, unlike Camera3D', () => {
    const scene = new THREE.Scene();
    const earlier = camera2d();
    const later = camera2d();
    scene.add(earlier, later);
    expect(selectViewportCamera2D(scene)).toBe(earlier);
    expect(selectViewportCamera2D(scene)).not.toBe(later);
  });

  /**
   * `enabled` gates the claim in the same `if`, and `set_enabled` repeats it, so
   * a disabled camera neither becomes current nor blocks a later one.
   */
  it('skips a disabled camera and elects the next enabled one', () => {
    const scene = new THREE.Scene();
    const disabled = camera2d({ enabled: false });
    const enabled = camera2d();
    scene.add(disabled, enabled);
    expect(selectViewportCamera2D(scene)).toBe(enabled);
  });

  it('returns null when every Camera2D is disabled', () => {
    const scene = new THREE.Scene();
    scene.add(camera2d({ enabled: false }), camera2d({ enabled: false }));
    expect(selectViewportCamera2D(scene)).toBeNull();
  });

  /** Godot leaves the canvas transform at identity, which is origin framing. */
  it('returns null for a subtree with no Camera2D rather than throwing', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.Object3D());
    expect(selectViewportCamera2D(scene)).toBeNull();
  });

  /** Every other CanvasItem group is untagged; only `<Camera2D>` tags itself. */
  it('ignores objects carrying no camera2d tag', () => {
    const scene = new THREE.Scene();
    const sprite = new THREE.Object3D();
    sprite.userData.tscnPath = 'Root/Sprite2D';
    scene.add(sprite);
    expect(selectViewportCamera2D(scene)).toBeNull();
  });

  /**
   * Pre-order traversal is the order nodes enter the tree, so a camera nested
   * inside an earlier instanced sub-scene beats a shallower later sibling —
   * which is precisely the `Player/Camera` case.
   */
  it('prefers a deeply nested earlier camera over a shallow later one', () => {
    const scene = new THREE.Scene();
    const player = new THREE.Object3D();
    const nested = camera2d();
    player.add(nested);
    const laterSibling = camera2d();
    scene.add(player, laterSibling);
    expect(selectViewportCamera2D(scene)).toBe(nested);
  });
});

describe('orthoFrameForCamera2D', () => {
  /** DRAG_CENTER (Godot's default) centres the view rect on the camera. */
  it('centres the view on the camera position', () => {
    const frame = orthoFrameForCamera2D(
      tagOf(camera2d()),
      { x: 400, y: 300 },
      { x: 200, y: 100 }
    );
    expect(frame.left).toBe(-100);
    expect(frame.right).toBe(100);
    expect(frame.top).toBe(50);
    expect(frame.bottom).toBe(-50);
    // Godot y is negated into three space, exactly as `orthoFrameForSize` does.
    expect(frame.position).toEqual([400, -300, 1000]);
  });

  /** Higher zoom is closer, so the view rect covers FEWER canvas pixels. */
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
   * `game_splitscreen.tscn`'s real numbers, and the reason the players are in
   * frame at all: Player1 sits at (100, 636.5) with the player's Camera2D at
   * local (0, -28) — world (100, 608.5) — offset (0, 50) and limits
   * [-715, -250, 1425, 690], in a 399x480 sub-viewport.
   *
   * The 480-tall view would run to y = 848.5, past `limit_bottom` 690, so Godot
   * clamps the RECT to top 210; the centre is then 210 + 240 + 50 = 500. A real
   * Godot 4.6 render of the scene at this size frames the identical rect.
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
   * Offset is added AFTER the clamp — the class reference's "the offsetted
   * camera can go past the limits". Same camera as above with no offset sits 50
   * canvas pixels higher.
   */
  it('applies offset after the clamp, so the view may leave the limits', () => {
    const clamped = orthoFrameForCamera2D(
      tagOf(camera2d({ limitTop: -250, limitBottom: 690 })),
      { x: 100, y: 608.5 },
      { x: 399, y: 480 }
    );
    expect(clamped.position[1]).toBe(-450);
  });

  /** FIXED_TOP_LEFT puts the camera AT the view's top-left corner. */
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

describe('godotCanvasPosition', () => {
  /** `node2dTransform` conjugates by diag(1,-1,1): Godot (100,50) is three (100,-50). */
  it('negates Y back out of three space', () => {
    const object = new THREE.Object3D();
    object.position.set(100, -50, 0);
    object.updateMatrixWorld(true);
    expect(godotCanvasPosition(object)).toEqual({ x: 100, y: 50 });
  });

  /**
   * The reason the pass reads the world matrix instead of walking the parsed
   * tree: a Camera2D inside an instanced sub-scene composes its ancestors' 2D
   * transforms for free.
   */
  it('composes an instanced ancestor transform', () => {
    const player = new THREE.Object3D();
    player.position.set(100, -636.5, 0);
    const cam = new THREE.Object3D();
    cam.position.set(0, 28, 0);
    player.add(cam);
    player.updateMatrixWorld(true);
    expect(godotCanvasPosition(cam)).toEqual({ x: 100, y: 608.5 });
  });
});

describe('applyOrthoFrame', () => {
  it('applies the frustum and position to the camera', () => {
    const cam = new THREE.OrthographicCamera();
    applyOrthoFrame(cam, orthoFrameForSize({ x: 300, y: 200 }));
    expect([cam.left, cam.right, cam.top, cam.bottom]).toEqual([-150, 150, 100, -100]);
    expect(cam.position.toArray()).toEqual([150, -100, 1000]);
  });

  /**
   * The pass recomputes a frame every rendered frame; a static scene must not
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

  /** A camera that only PANS still needs its new position, matrix rebuild or not. */
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

describe('createOffscreenTarget', () => {
  /**
   * Godot tonemaps EVERY viewport render, a sub-viewport's included.
   * `renderer_scene_render_rd.cpp`, `_render_buffers_post_process_and_tonemap`
   * (Godot 4.4) reads the viewport's environment and runs the curve into the
   * viewport's own target:
   *
   *     tonemap.tonemap_mode = environment_get_tone_mapper(p_render_data->environment);
   *     ...
   *     tone_mapper->tonemapper(color_texture, dest_fb, tonemap);
   *
   * A shared-world sub-viewport gets the SAME environment as the main view
   * (`viewport.cpp`, `Viewport::find_world_3d()`: `return
   * parent->find_world_3d();`), so its target stores POST-tonemap values and
   * the main viewport tonemaps the consuming surface again — the curve applies
   * twice to anything seen through a target. three structurally refuses the
   * first application: `WebGLPrograms.js` grants `toneMapping =
   * renderer.toneMapping` only when `currentRenderTarget === null ||
   * currentRenderTarget.isXRRenderTarget === true`. The flag is the one switch
   * that flips that decision, and it is a measured brightness contract, not a
   * hint: without it, `unit-sub-viewport-texture.tscn` under the ADR-0025
   * preview environment (FILMIC) sampled 0.60–0.65x of Godot in linear terms
   * through the quad while matching the direct view exactly — and applying the
   * ported FILMIC curve once to the previewer's own probes reproduced Godot's
   * to within three code values (the sky sample exactly: rgb(177, 194, 212)).
   */
  it('marks the target so three tonemaps the offscreen pass like the main pass', () => {
    const target = createOffscreenTarget(64, 64, 'Probe');
    expect((target as { isXRRenderTarget?: boolean }).isXRRenderTarget).toBe(true);
    target.dispose();
  });

  /**
   * With `isXRRenderTarget` set, three takes the pass's output space from
   * `texture.colorSpace` (`WebGLPrograms.js`, the same decision as above), so
   * LINEAR is load-bearing twice over: the pass writes working-space values
   * with no encode, and a consuming material samples them back with no decode
   * — the identity round trip. Tagging the target sRGB would install a
   * shader-side encode ON TOP of the SRGB8 hardware encode three allocates for
   * sRGB target textures, and everything sampled through it would darken.
   */
  it('stores the working colour space, so write and sample round-trip exactly', () => {
    const target = createOffscreenTarget(64, 64, 'Probe');
    expect(target.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    target.dispose();
  });

  /**
   * Linear min/mag with no mipmaps matches Godot's default
   * `canvas_item_default_texture_filter` (1, LINEAR); depth without stencil is
   * what a 3D pass needs and nothing more.
   */
  it('samples linearly without mipmaps, and carries depth but no stencil', () => {
    const target = createOffscreenTarget(64, 64, 'Probe');
    expect(target.texture.minFilter).toBe(THREE.LinearFilter);
    expect(target.texture.magFilter).toBe(THREE.LinearFilter);
    expect(target.texture.generateMipmaps).toBe(false);
    expect(target.depthBuffer).toBe(true);
    expect(target.stencilBuffer).toBe(false);
    target.dispose();
  });

  it('names the texture after the sub-viewport and sizes it to the rect', () => {
    const target = createOffscreenTarget(320, 240, 'Viewport');
    expect(target.texture.name).toBe('Viewport::target');
    expect(target.width).toBe(320);
    expect(target.height).toBe(240);
    target.dispose();
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
