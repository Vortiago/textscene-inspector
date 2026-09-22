/**
 * `controlPixelSnap.ts` against Godot 4.6.3's
 * `Control::_update_canvas_item_transform`. Expected values come from the C++
 * and from pixels measured through real Godot, never from our own renderer.
 */
import { describe, expect, it } from 'vitest';
import type { Rect2 } from './rect';
import {
  SNAP_CONTROLS_TO_PIXELS_SETTING,
  internalTransformTranslation,
  snapControlsToPixelsEnabled,
  snappedControlOrigin,
  type ControlDrawTransform,
} from './controlPixelSnap';

const IDENTITY: ControlDrawTransform = { rotation: 0, scale: { x: 1, y: 1 }, pivot: { x: 0, y: 0 } };

describe('snapControlsToPixelsEnabled', () => {
  it('is on when the project says nothing (GLOBAL_DEF_BASIC(…, true))', () => {
    expect(snapControlsToPixelsEnabled(null)).toBe(true);
    expect(snapControlsToPixelsEnabled({})).toBe(true);
  });

  it('is off for the literal `false` Godot writes', () => {
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: 'false' })).toBe(false);
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: '  false  ' })).toBe(false);
  });

  it('is off for a ZERO too — `bool snap_controls = GLOBAL_GET(…)` booleanizes (main.cpp:4577, variant_op.cpp:1114-1122)', () => {
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: '0' })).toBe(false);
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: '0.0' })).toBe(false);
  });

  it('is on for any non-zero number — `booleanize` is `!is_zero()`, not a test against 1', () => {
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: '1' })).toBe(true);
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: '2' })).toBe(true);
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: '-1' })).toBe(true);
  });

  it('keeps the default for `true`, an empty value, and anything unrecognised', () => {
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: 'true' })).toBe(true);
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: '' })).toBe(true);
    expect(snapControlsToPixelsEnabled({ [SNAP_CONTROLS_TO_PIXELS_SETTING]: 'maybe' })).toBe(true);
  });

  it('reads the key under the name `parseProjectSettings` produces, section prefix and all', () => {
    expect(SNAP_CONTROLS_TO_PIXELS_SETTING).toBe('gui/common/snap_controls_to_pixels');
    // The bare key, without the `[gui]` prefix, addresses nothing.
    expect(snapControlsToPixelsEnabled({ 'common/snap_controls_to_pixels': 'false' })).toBe(true);
  });
});

describe('internalTransformTranslation', () => {
  it('is zero for an identity basis, whatever the pivot', () => {
    const t = internalTransformTranslation({ ...IDENTITY, pivot: { x: 37.5, y: -12.25 } });

    expect(t.x).toBeCloseTo(0);
    expect(t.y).toBeCloseTo(0);
  });

  it('is `pivot - basis * pivot` for a pure scale', () => {
    const t = internalTransformTranslation({
      rotation: 0,
      scale: { x: 2, y: 3 },
      pivot: { x: 10.25, y: 4 },
    });

    expect(t.x).toBeCloseTo(10.25 - 20.5);
    expect(t.y).toBeCloseTo(4 - 12);
  });

  it('rotates the pivot through the Transform2D basis (+90° maps (x, y) to (-y, x))', () => {
    const t = internalTransformTranslation({
      rotation: Math.PI / 2,
      scale: { x: 1, y: 1 },
      pivot: { x: 10, y: 0 },
    });

    expect(t.x).toBeCloseTo(10 - 0);
    expect(t.y).toBeCloseTo(0 - 10);
  });

  it('is zero when the pivot is zero, however the basis is built', () => {
    const t = internalTransformTranslation({ rotation: 1.1, scale: { x: 4, y: -2 }, pivot: { x: 0, y: 0 } });

    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });
});

describe('snappedControlOrigin', () => {
  it('floors `position + 0.5` on each axis for an untransformed Control', () => {
    // Measured through Godot 4.6.3: a ColorRect at offset 400.5 draws its
    // first solid row/column at 401, with no half-pixel blend.
    const origin = snappedControlOrigin({ x: 400.5, y: 306.5 }, IDENTITY, true);

    expect(origin).toEqual({ x: 401, y: 307 });
  });

  it('floors rather than rounds toward zero on a negative axis', () => {
    expect(snappedControlOrigin({ x: -0.6, y: -0.5 }, IDENTITY, true)).toEqual({ x: -1, y: 0 });
    expect(snappedControlOrigin({ x: -1.5, y: -2.75 }, IDENTITY, true)).toEqual({ x: -1, y: -3 });
  });

  it('leaves a whole position untouched', () => {
    expect(snappedControlOrigin({ x: 100, y: -50 }, IDENTITY, true)).toEqual({ x: 100, y: -50 });
  });

  it('snaps at every multiple of 45°, where `sin(rotation * 4)` vanishes', () => {
    for (const eighth of [0, 1, 2, 3, 4, -1, -3]) {
      const rotation = (eighth * Math.PI) / 4;
      const origin = snappedControlOrigin({ x: 10.5, y: 20.5 }, { ...IDENTITY, rotation }, true);

      expect(origin, `rotation ${rotation}`).toEqual({ x: 11, y: 21 });
    }
  });

  it('leaves the position alone at any other angle', () => {
    for (const rotation of [0.3, Math.PI / 6, -1.2]) {
      const origin = snappedControlOrigin({ x: 10.5, y: 20.5 }, { ...IDENTITY, rotation }, true);

      expect(origin, `rotation ${rotation}`).toEqual({ x: 10.5, y: 20.5 });
    }
  });

  it('still snaps just inside the epsilon, and stops just outside it', () => {
    // |sin(4r)| < 0.00001 → r within ~2.5e-6 rad of a multiple of 45°.
    const inside = snappedControlOrigin({ x: 10.5, y: 10.5 }, { ...IDENTITY, rotation: 1e-6 }, true);
    const outside = snappedControlOrigin({ x: 10.5, y: 10.5 }, { ...IDENTITY, rotation: 1e-4 }, true);

    expect(inside).toEqual({ x: 11, y: 11 });
    expect(outside).toEqual({ x: 10.5, y: 10.5 });
  });

  it('snaps the SUM of the position and the internal translation, returning the outer half', () => {
    // Measured through Godot 4.6.3: a ColorRect at (100, 100) with
    // pivot_offset (10.25, 10.25) and scale (2, 2) draws its top-left at
    // exactly 90 — floor(100 - 10.25 + 0.5) — not at 89.75.
    const transform: ControlDrawTransform = {
      rotation: 0,
      scale: { x: 2, y: 2 },
      pivot: { x: 10.25, y: 10.25 },
    };
    const origin = snappedControlOrigin({ x: 100, y: 100 }, transform, true);
    const internal = internalTransformTranslation(transform);

    expect(origin.x + internal.x).toBeCloseTo(90);
    expect(origin.y + internal.y).toBeCloseTo(90);
    expect(origin.x).toBeCloseTo(100.25);
  });

  it('returns the position verbatim when the project disabled the snap', () => {
    expect(snappedControlOrigin({ x: 400.5, y: 306.5 }, IDENTITY, false)).toEqual({ x: 400.5, y: 306.5 });
  });

  it('does not snap a non-finite rotation, matching the float comparison it ports', () => {
    const origin = snappedControlOrigin({ x: 10.5, y: 10.5 }, { ...IDENTITY, rotation: Number.NaN }, true);

    expect(origin).toEqual({ x: 10.5, y: 10.5 });
  });

  it('reads only x and y off the position, so a solved Rect2 passes straight in', () => {
    const rect: Rect2 = { x: 1.5, y: 2.5, w: 80, h: 40 };

    expect(snappedControlOrigin(rect, IDENTITY, true)).toEqual({ x: 2, y: 3 });
  });
});
