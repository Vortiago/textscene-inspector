/**
 * Tests for the CapsuleShape3D decode.
 *
 * Ported from Godot `capsule_shape_3d.cpp`: `set_radius` (:101-110) RAISES
 * height to `radius * 2` when it is shorter, `set_height` (:115-124) LOWERS
 * radius to `height * 0.5` when it exceeds the half-height, and each rejects a
 * negative argument outright (`ERR_FAIL_COND_MSG`, :102 / :116) leaving the
 * property at its prior value. The loader assigns in class-property order —
 * ADD_PROPERTY radius (:148) then height (:149) — so with both authored,
 * height wins and radius is the one that clamps down. Defaults come from
 * `capsule_shape_3d.h:39-40` (0.5 / 2.0).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeCapsuleShape3D } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeCapsuleShape3D', () => {
  it('honours a well-formed capsule (height >= 2 * radius)', () => {
    expect(decodeCapsuleShape3D({ radius: '1', height: '4' })).toEqual({ radius: 1, height: 4 });
  });

  it('falls back to the Godot defaults (0.5 / 2) when both are absent, silently', () => {
    expect(decodeCapsuleShape3D({})).toEqual({ radius: 0.5, height: 2 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps the sphere boundary height == 2 * radius exactly as authored', () => {
    expect(decodeCapsuleShape3D({ radius: '1', height: '2' })).toEqual({ radius: 1, height: 2 });
  });

  it('clamps RADIUS down when both are authored and the capsule is too short', () => {
    // set_radius(1) leaves height (2 is not < 2), then set_height(1) lowers
    // radius to 0.5 — height authored last wins.
    expect(decodeCapsuleShape3D({ radius: '1', height: '1' })).toEqual({ radius: 0.5, height: 1 });
  });

  it('raises height when only radius is authored', () => {
    // set_radius(2) finds the default height 2 < 4 and raises it.
    expect(decodeCapsuleShape3D({ radius: '2' })).toEqual({ radius: 2, height: 4 });
  });

  it('lowers the default radius when only height is authored and it is short', () => {
    expect(decodeCapsuleShape3D({ height: '0.5' })).toEqual({ radius: 0.25, height: 0.5 });
  });

  it('leaves the default radius alone when only a tall height is authored', () => {
    expect(decodeCapsuleShape3D({ height: '10' })).toEqual({ radius: 0.5, height: 10 });
  });

  it('rejects a negative value the way Godot ERR_FAILs it — property stays unset', () => {
    expect(decodeCapsuleShape3D({ radius: '-3', height: '4' })).toEqual({ radius: 0.5, height: 4 });
    expect(decodeCapsuleShape3D({ radius: '1', height: '-4' })).toEqual({ radius: 1, height: 2 });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('warns then keeps the defaults for malformed values (never NaN)', () => {
    const result = decodeCapsuleShape3D({ radius: 'nope', height: 'nope' });
    expect(result).toEqual({ radius: 0.5, height: 2 });
    expect(Number.isNaN(result.radius + result.height)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('never produces a negative cylindrical section for the gizmo', () => {
    const cases: Record<string, string>[] = [
      { radius: '5', height: '1' },
      { radius: '0.4', height: '0.5' },
      { height: '0.2' },
      { radius: '3' },
    ];
    for (const properties of cases) {
      const { radius, height } = decodeCapsuleShape3D(properties);
      expect(height - radius * 2).toBeGreaterThanOrEqual(0);
    }
  });
});
