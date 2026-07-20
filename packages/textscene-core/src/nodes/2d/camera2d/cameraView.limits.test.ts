/**
 * Camera2D scroll limits.
 *
 * `camera_2d.cpp::get_camera_transform()` clamps the view rect into the limit
 * rect BEFORE adding `offset` (the docs say so too: "The offsetted camera can
 * go past the limits"), and the clamp has three branches per axis:
 *
 *   1. view wider than the limit span → CENTRE it in the span
 *   2. past the near edge            → snap to it
 *   3. past the far edge             → snap the far edge back
 *
 * gated on `limit_enabled` (default true). None of it was implemented, so
 * "look through" a limited camera framed somewhere Godot would never scroll to.
 */
import { describe, expect, it } from 'vitest';
import { camera2DView } from './cameraView';
import { parseCamera2D } from './parser';
import type { Camera2DProperties } from './types';

const heading = { type: 'node', attributes: { name: 'Cam', type: 'Camera2D' } };
const VIEWPORT = { x: 1152, y: 648 };

function props(raw: Record<string, string> = {}): Camera2DProperties {
  return parseCamera2D(heading, raw);
}

/** Top-left of the framed view, which is what Godot actually clamps. */
function topLeft(view: { center: { x: number; y: number }; zoom: number }) {
  return {
    x: view.center.x - VIEWPORT.x / (2 * view.zoom),
    y: view.center.y - VIEWPORT.y / (2 * view.zoom),
  };
}

describe('camera2DView limits', () => {
  it('parses the Godot limit defaults', () => {
    const p = props();
    expect(p.limitLeft).toBe(-10000000);
    expect(p.limitTop).toBe(-10000000);
    expect(p.limitRight).toBe(10000000);
    expect(p.limitBottom).toBe(10000000);
    expect(p.limitEnabled).toBe(true);
  });

  it('leaves an unlimited camera exactly where it was', () => {
    const view = camera2DView(props(), { x: 500, y: 300 }, VIEWPORT);
    expect(view.center).toEqual({ x: 500, y: 300 });
  });

  it('snaps the view to the near edge when it runs past it', () => {
    const view = camera2DView(
      props({ limit_left: '0', limit_top: '0' }),
      { x: 0, y: 0 },
      VIEWPORT
    );
    expect(topLeft(view).x).toBeCloseTo(0, 5);
    expect(topLeft(view).y).toBeCloseTo(0, 5);
  });

  it('snaps the far edge back when the view overruns it', () => {
    const view = camera2DView(
      props({ limit_left: '0', limit_right: '2000' }),
      { x: 5000, y: 0 },
      VIEWPORT
    );
    expect(topLeft(view).x).toBeCloseTo(2000 - VIEWPORT.x, 5);
  });

  it('centres the view in the span when the span is narrower than the view', () => {
    // Span 400 px, view 1152 px → Godot splits the difference.
    const view = camera2DView(
      props({ limit_left: '0', limit_right: '400' }),
      { x: 5000, y: 0 },
      VIEWPORT
    );
    expect(topLeft(view).x).toBeCloseTo((0 + 400 - VIEWPORT.x) / 2, 5);
  });

  it('measures the view at the camera zoom', () => {
    // zoom 2 halves the view to 576 px, so it now FITS the 800-px span.
    const view = camera2DView(
      props({ zoom: 'Vector2(2, 2)', limit_left: '0', limit_right: '800' }),
      { x: 5000, y: 0 },
      VIEWPORT
    );
    expect(topLeft(view).x).toBeCloseTo(800 - VIEWPORT.x / 2, 5);
  });

  it('lets `offset` push the view PAST the limit, as the docs state', () => {
    const clamped = camera2DView(props({ limit_left: '0' }), { x: 0, y: 0 }, VIEWPORT);
    const offset = camera2DView(
      props({ limit_left: '0', offset: 'Vector2(-100, 0)' }),
      { x: 0, y: 0 },
      VIEWPORT
    );
    expect(offset.center.x).toBeCloseTo(clamped.center.x - 100, 5);
  });

  it('ignores the limits when limit_enabled is false', () => {
    const view = camera2DView(
      props({ limit_enabled: 'false', limit_left: '0', limit_right: '400' }),
      { x: 5000, y: 0 },
      VIEWPORT
    );
    expect(view.center.x).toBe(5000);
  });
});
