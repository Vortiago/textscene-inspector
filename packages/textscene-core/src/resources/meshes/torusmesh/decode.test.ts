/**
 * Tests for the TorusMesh decode.
 *
 * Defaults from Godot `primitive_meshes.h:377-380`. `set_rings`
 * (`primitive_meshes.cpp:2344-2355`) ERR_FAILs below 3 and `set_ring_segments`
 * (:2357-2368) does the same, so either keeps its default rather than storing a
 * count no ring can be built from. The radii have no setter guard (:2320-2341);
 * their inner > outer / inner == outer handling is mesh-build time, in `build.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeTorusMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeTorusMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodeTorusMesh({})).toEqual({
      innerRadius: 0.5,
      outerRadius: 1,
      rings: 64,
      ringSegments: 32,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads every authored field', () => {
    expect(
      decodeTorusMesh({
        inner_radius: '1',
        outer_radius: '3',
        rings: '12',
        ring_segments: '6',
      })
    ).toEqual({ innerRadius: 1, outerRadius: 3, rings: 12, ringSegments: 6 });
  });

  it('rejects rings below 3 (ERR_FAIL keeps the default 64)', () => {
    expect(decodeTorusMesh({ rings: '2' }).rings).toBe(64);
    expect(decodeTorusMesh({ rings: '0' }).rings).toBe(64);
    expect(decodeTorusMesh({ rings: '-5' }).rings).toBe(64);
    expect(decodeTorusMesh({ rings: '3' }).rings).toBe(3);
  });

  it('rejects ring_segments below 3 (ERR_FAIL keeps the default 32)', () => {
    expect(decodeTorusMesh({ ring_segments: '2' }).ringSegments).toBe(32);
    expect(decodeTorusMesh({ ring_segments: '-1' }).ringSegments).toBe(32);
    expect(decodeTorusMesh({ ring_segments: '3' }).ringSegments).toBe(3);
  });

  it('keeps a swapped radius pair as authored — the swap is build-time', () => {
    expect(decodeTorusMesh({ inner_radius: '2', outer_radius: '1' })).toMatchObject({
      innerRadius: 2,
      outerRadius: 1,
    });
  });

  it('warns then falls back per property for malformed values (never NaN)', () => {
    const p = decodeTorusMesh({ inner_radius: 'nope', rings: 'nope' });
    expect(p.innerRadius).toBe(0.5);
    expect(p.rings).toBe(64);
    expect(warnSpy).toHaveBeenCalled();
  });
});
