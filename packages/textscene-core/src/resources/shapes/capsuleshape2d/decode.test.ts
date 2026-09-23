/**
 * CapsuleShape2D decode, the 3D capsule's clamp from `capsule_shape_2d.cpp`: `set_radius`
 * (:61-75) raises height to `radius * 2`, `set_height` (:77-91) lowers radius to
 * `height * 0.5`, both ERR_FAIL on a negative (:62 / :78), and radius (:134) loads
 * before height (:135). Defaults: `capsule_shape_2d.h:38-39` (height 30, radius 10).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeCapsuleShape2D } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeCapsuleShape2D', () => {
  it('honours a well-formed capsule', () => {
    expect(decodeCapsuleShape2D({ radius: '15', height: '40' })).toEqual({
      radius: 15,
      height: 40,
    });
  });

  it('falls back to the Godot defaults (radius 10, height 30) when absent, silently', () => {
    expect(decodeCapsuleShape2D({})).toEqual({ radius: 10, height: 30 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps the circle boundary height == 2 * radius exactly as authored', () => {
    expect(decodeCapsuleShape2D({ radius: '10', height: '20' })).toEqual({
      radius: 10,
      height: 20,
    });
  });

  it('clamps RADIUS down when both are authored and the capsule is too short', () => {
    expect(decodeCapsuleShape2D({ radius: '20', height: '20' })).toEqual({
      radius: 10,
      height: 20,
    });
  });

  it('raises height when only radius is authored', () => {
    expect(decodeCapsuleShape2D({ radius: '20' })).toEqual({ radius: 20, height: 40 });
  });

  it('lowers the default radius when only a short height is authored', () => {
    expect(decodeCapsuleShape2D({ height: '10' })).toEqual({ radius: 5, height: 10 });
  });

  it('rejects a negative value the way Godot ERR_FAILs it — property stays unset', () => {
    expect(decodeCapsuleShape2D({ radius: '-5', height: '40' })).toEqual({
      radius: 10,
      height: 40,
    });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('warns then keeps the defaults for malformed values (never NaN)', () => {
    const result = decodeCapsuleShape2D({ radius: 'nope', height: 'nope' });
    expect(result).toEqual({ radius: 10, height: 30 });
    expect(Number.isNaN(result.radius + result.height)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('never leaves the caps overlapping — the outline needs a non-negative straight side', () => {
    const cases: Record<string, string>[] = [
      { radius: '50', height: '10' },
      { height: '4' },
      { radius: '30' },
    ];
    for (const properties of cases) {
      const { radius, height } = decodeCapsuleShape2D(properties);
      expect(height / 2 - radius).toBeGreaterThanOrEqual(0);
    }
  });
});
