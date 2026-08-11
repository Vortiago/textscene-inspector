/**
 * camera2DView — what a Camera2D actually frames: the view center in Godot
 * canvas pixels and the magnification, honoring anchor_mode and offset.
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
    // Camera far past the left/top limits: the view's LEFT edge pins to 0, so
    // the centre is half the view extent regardless of where the camera sits.
    const view = camera2DView(props(LIMITS), { x: -5000, y: -5000 }, VIEWPORT);
    expect(view.center).toEqual({ x: 288, y: 162 });
  });

  it('pins the view rect to the far limit', () => {
    // The view's RIGHT/BOTTOM edges pin to the far limits: centre = far - extent/2.
    const view = camera2DView(props(LIMITS), { x: 5000, y: 5000 }, VIEWPORT);
    expect(view.center).toEqual({ x: 2000 - 288, y: 2000 - 162 });
  });

  it('leaves a position inside the limits alone', () => {
    const view = camera2DView(props(LIMITS), { x: 700, y: 700 }, VIEWPORT);
    expect(view.center).toEqual({ x: 700, y: 700 });
  });

  it('centres a view WIDER than the limit span instead of pinning an edge', () => {
    // Godot's first branch: near > far - extent. Span 100 < extent 576, so the
    // view centres on the span's midpoint — pinning to either edge would show
    // more out-of-limits world on one side than the other.
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
