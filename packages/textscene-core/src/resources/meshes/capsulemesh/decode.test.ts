/**
 * Tests for the CapsuleMesh decode.
 *
 * Ported from Godot `scene/resources/3d/primitive_meshes.cpp`: `set_radius`
 * (:632-647) RAISES height to `radius * 2` when the radius exceeds the half
 * height, `set_height` (:649-664) LOWERS radius to `height * 0.5` in the same
 * situation, and the loader assigns in class-property order — radius (:623) then
 * height (:624), the pair Godot links explicitly (ADD_LINKED_PROPERTY :628-629).
 * `set_radial_segments` (:666-677) floors at 4; `set_rings` (:679-690) ERR_FAILs
 * below 0, keeping the default. Unlike CapsuleShape3D neither float setter
 * rejects a negative. Defaults from `primitive_meshes.h:130-133`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeCapsuleMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeCapsuleMesh', () => {
  it('honours a well-formed capsule', () => {
    expect(decodeCapsuleMesh({ radius: '1', height: '5', radial_segments: '16', rings: '4' })).toEqual(
      { radius: 1, height: 5, radialSegments: 16, rings: 4 }
    );
  });

  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodeCapsuleMesh({})).toEqual({
      radius: 0.5,
      height: 2,
      radialSegments: 64,
      rings: 8,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('raises height to 2 x radius when only radius is authored', () => {
    expect(decodeCapsuleMesh({ radius: '2' })).toMatchObject({ radius: 2, height: 4 });
  });

  it('lowers radius when both are authored and the capsule is too short', () => {
    // set_radius(2) raises height to 4, then set_height(2) lowers radius to 1 —
    // the height authored last stands.
    expect(decodeCapsuleMesh({ radius: '2', height: '2' })).toMatchObject({
      radius: 1,
      height: 2,
    });
  });

  it('lowers the default radius when only a short height is authored', () => {
    expect(decodeCapsuleMesh({ height: '0.5' })).toMatchObject({ radius: 0.25, height: 0.5 });
  });

  it('keeps the sphere boundary height == 2 x radius as authored', () => {
    expect(decodeCapsuleMesh({ radius: '1', height: '2' })).toMatchObject({
      radius: 1,
      height: 2,
    });
  });

  it('floors radial_segments at 4, not merely at 0', () => {
    expect(decodeCapsuleMesh({ radial_segments: '2' }).radialSegments).toBe(4);
    expect(decodeCapsuleMesh({ radial_segments: '4' }).radialSegments).toBe(4);
    expect(decodeCapsuleMesh({ radial_segments: '-8' }).radialSegments).toBe(4);
    expect(decodeCapsuleMesh({ radial_segments: '80' }).radialSegments).toBe(80);
  });

  it('rejects rings below 0 (ERR_FAIL keeps the default) but allows 0', () => {
    expect(decodeCapsuleMesh({ rings: '-1' }).rings).toBe(8);
    expect(decodeCapsuleMesh({ rings: '0' }).rings).toBe(0);
  });

  it('accepts a negative radius, as Godot does — no ERR_FAIL on this setter', () => {
    // CapsuleMesh::set_radius has no negative guard (unlike CapsuleShape3D), and
    // `radius > height * 0.5` is false for a negative, so nothing clamps.
    expect(decodeCapsuleMesh({ radius: '-1' })).toMatchObject({ radius: -1, height: 2 });
  });

  it('warns then keeps the defaults for malformed values (never NaN)', () => {
    const result = decodeCapsuleMesh({ radius: 'nope', height: 'nope', rings: 'nope' });
    expect(result).toEqual({ radius: 0.5, height: 2, radialSegments: 64, rings: 8 });
    expect(Number.isNaN(result.radius + result.height)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});
