/** Tests for the SeparationRayShape3D decode: defaults and setters from `separation_ray_shape_3d.cpp`. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeSeparationRayShape3D } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeSeparationRayShape3D', () => {
  it('honours an authored length and slide_on_slope', () => {
    expect(decodeSeparationRayShape3D({ length: '2.5', slide_on_slope: 'true' })).toEqual({
      length: 2.5,
      slideOnSlope: true,
    });
  });

  // Defaults: `separation_ray_shape_3d.h:39-40`.
  it('falls back to the Godot defaults (1 / false) when both are absent, silently', () => {
    expect(decodeSeparationRayShape3D({})).toEqual({ length: 1, slideOnSlope: false });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps a negative length as authored (set_length does not validate)', () => {
    expect(decodeSeparationRayShape3D({ length: '-3' }).length).toBe(-3);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps a zero length as authored', () => {
    expect(decodeSeparationRayShape3D({ length: '0' }).length).toBe(0);
  });

  it('warns then keeps the defaults for malformed values (never NaN)', () => {
    const result = decodeSeparationRayShape3D({ length: 'nope', slide_on_slope: 'maybe' });
    expect(result).toEqual({ length: 1, slideOnSlope: false });
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
