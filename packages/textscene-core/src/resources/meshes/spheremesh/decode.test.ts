/**
 * Tests for the SphereMesh decode.
 *
 * Defaults from Godot `primitive_meshes.h:339-343`. `set_radial_segments`
 * (`primitive_meshes.cpp:2137-2147`) floors at 4; `set_rings` (:2149-2160)
 * ERR_FAILs below 1, which keeps the default rather than storing the value.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeSphereMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeSphereMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodeSphereMesh({})).toEqual({
      radius: 0.5,
      height: 1,
      radial_segments: 64,
      rings: 32,
      isHemisphere: false,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads every authored field', () => {
    expect(
      decodeSphereMesh({
        radius: '2',
        height: '3',
        radial_segments: '16',
        rings: '8',
        is_hemisphere: 'true',
      })
    ).toEqual({ radius: 2, height: 3, radial_segments: 16, rings: 8, isHemisphere: true });
  });

  it('floors radial_segments at 4, not merely at 0', () => {
    expect(decodeSphereMesh({ radial_segments: '3' }).radial_segments).toBe(4);
    expect(decodeSphereMesh({ radial_segments: '-10' }).radial_segments).toBe(4);
    expect(decodeSphereMesh({ radial_segments: '128' }).radial_segments).toBe(128);
  });

  it('rejects rings below 1 (ERR_FAIL keeps the default 32)', () => {
    expect(decodeSphereMesh({ rings: '0' }).rings).toBe(32);
    expect(decodeSphereMesh({ rings: '-4' }).rings).toBe(32);
    expect(decodeSphereMesh({ rings: '1' }).rings).toBe(1);
  });

  it('warns then falls back per property for malformed values (never NaN)', () => {
    const p = decodeSphereMesh({ radius: 'nope', rings: 'nope' });
    expect(p.radius).toBe(0.5);
    expect(p.rings).toBe(32);
    expect(warnSpy).toHaveBeenCalled();
  });
});
