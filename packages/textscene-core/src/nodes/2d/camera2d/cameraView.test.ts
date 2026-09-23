/**
 * camera2DView: what a Camera2D frames, as the view centre in Godot canvas pixels
 * and the magnification, with anchor_mode and offset applied.
 */
import { describe, it, expect } from 'vitest';
import { camera2DView, type Camera2DTag } from './cameraView';
import { Camera2DAnchorMode } from './types';

const VIEWPORT = { x: 1152, y: 648 };

function props(overrides: Partial<Camera2DTag> = {}): Camera2DTag {
  return {
    zoom: { x: 2, y: 2 },
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

describe('camera2DView', () => {
  it('DRAG_CENTER (default): the camera position IS the view center', () => {
    const view = camera2DView(props(), { x: 300, y: 200 }, VIEWPORT);
    expect(view.center).toEqual({ x: 300, y: 200 });
    expect(view.zoom).toBe(2);
  });

  it('applies the pixel offset', () => {
    const view = camera2DView(props({ offset: { x: 50, y: -20 } }), { x: 300, y: 200 }, VIEWPORT);
    expect(view.center).toEqual({ x: 350, y: 180 });
  });

  it('FIXED_TOP_LEFT: the camera position is the view top-left (view size = viewport / zoom)', () => {
    const view = camera2DView(
      props({ anchor_mode: Camera2DAnchorMode.FIXED_TOP_LEFT }),
      { x: 0, y: 0 },
      VIEWPORT
    );
    expect(view.center).toEqual({ x: 1152 / 4, y: 648 / 4 }); // viewport/(2·zoom)
  });
});

describe('camera2DView limit clamping', () => {
  // View extent at zoom 2: 576 × 324. Limits form a 2000 × 2000 span, so the
  // view fits and the pin branches (not the centring one) decide.
  const LIMITS = { limitLeft: 0, limitTop: 0, limitRight: 2000, limitBottom: 2000 };

  it('pins the view rect to the near limit', () => {
    // Camera far past the left/top limits: the view's left edge pins to 0, so
    // the centre is half the view extent regardless of where the camera sits.
    const view = camera2DView(props(LIMITS), { x: -5000, y: -5000 }, VIEWPORT);
    expect(view.center).toEqual({ x: 288, y: 162 });
  });

  it('pins the view rect to the far limit', () => {
    // The view's right and bottom edges pin to the far limits: centre = far - extent/2.
    const view = camera2DView(props(LIMITS), { x: 5000, y: 5000 }, VIEWPORT);
    expect(view.center).toEqual({ x: 2000 - 288, y: 2000 - 162 });
  });

  it('leaves a position inside the limits alone', () => {
    const view = camera2DView(props(LIMITS), { x: 700, y: 700 }, VIEWPORT);
    expect(view.center).toEqual({ x: 700, y: 700 });
  });

  it('centres a view WIDER than the limit span instead of pinning an edge', () => {
    // Godot's first branch: near > far - extent. Span 100 < extent 576, so the
    // view centres on the span's midpoint.
    const view = camera2DView(
      props({ ...LIMITS, limitRight: 100, limitBottom: 100 }),
      { x: -5000, y: 5000 },
      VIEWPORT
    );
    expect(view.center).toEqual({ x: 50, y: 50 });
  });

  it('does not clamp when limit smoothing disables the limits', () => {
    const view = camera2DView(props({ ...LIMITS, limitEnabled: false }), { x: -5000, y: -5000 }, VIEWPORT);
    expect(view.center).toEqual({ x: -5000, y: -5000 });
  });
});

describe('a non-uniform zoom frames per axis, as the engine does', () => {
  // `zoom_scale = Vector2(1, 1) / zoom` (camera_2d.cpp:107) and the rect is
  // `screen_size * zoom_scale` (:163), both per axis: Godot frames 576x648 here,
  // and the height feeds the limit clamp and the returned centre.
  const view = (zoom: { x: number; y: number }) =>
    camera2DView(
      {
        zoom,
        offset: { x: 0, y: 0 },
        anchor_mode: Camera2DAnchorMode.DRAG_CENTER,
        limitEnabled: false,
        limitLeft: -10000000,
        limitRight: 10000000,
        limitTop: -10000000,
        limitBottom: 10000000,
      } as Parameters<typeof camera2DView>[0],
      { x: 0, y: 0 },
      { x: 1152, y: 648 }
    );

  it('divides each axis by its own zoom', () => {
    expect(view({ x: 2, y: 1 }).size).toEqual({ x: 576, y: 648 });
    expect(view({ x: 1, y: 2 }).size).toEqual({ x: 1152, y: 324 });
  });

  it('leaves a uniform zoom framing what it always did', () => {
    expect(view({ x: 2, y: 2 }).size).toEqual({ x: 576, y: 324 });
  });
});

describe('a zoom set_zoom refuses leaves the default (1, 1) on BOTH axes', () => {
  // `ERR_FAIL_COND_MSG(Math::is_zero_approx(p_zoom.x) || Math::is_zero_approx(p_zoom.y), …)`
  // (camera_2d.cpp:104) returns before `zoom = p_zoom`, so the whole write is
  // dropped: one zero component must not let the other take effect.
  it('frames Vector2(0, 2) at the unzoomed viewport', () => {
    const view = camera2DView(props({ zoom: { x: 0, y: 2 } }), { x: 0, y: 0 }, VIEWPORT);
    expect(view.size).toEqual(VIEWPORT);
    expect(view.zoom).toBe(1);
  });

  it('frames Vector2(2, 1e-9) at the unzoomed viewport', () => {
    const view = camera2DView(props({ zoom: { x: 2, y: 1e-9 } }), { x: 0, y: 0 }, VIEWPORT);
    expect(view.size).toEqual(VIEWPORT);
    expect(view.zoom).toBe(1);
  });
});
