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
