/** Tests for the BoxShape3D decode — canonical parseVector3 contract. */

import { describe, expect, it } from 'vitest';
import { decodeBoxShape3D } from './decode';
import { canonicalisePropertyBag } from '../../../godot/deprecated';

describe('decodeBoxShape3D', () => {
  it('honours a valid size', () => {
    expect(decodeBoxShape3D({ size: 'Vector3(2, 3, 4)' }).size).toEqual({ x: 2, y: 3, z: 4 });
    expect(decodeBoxShape3D({ size: 'Vector3(2, 4, 0.3)' }).size).toEqual({ x: 2, y: 4, z: 0.3 });
  });

  it('defaults to Vector3(1,1,1) when size is absent', () => {
    expect(decodeBoxShape3D({}).size).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('falls back to the {1,1,1} default for loose-regex-only garbage', () => {
    expect(decodeBoxShape3D({ size: 'Vector3(--1, 2, 3)' }).size).toEqual({ x: 1, y: 1, z: 1 });
    expect(decodeBoxShape3D({ size: 'Vector3(+1, 2, 3)' }).size).toEqual({ x: 1, y: 1, z: 1 });
  });
});

describe('decodeBoxShape3D negative size', () => {
  it('refuses the whole size when any component is negative (box_shape_3d.cpp:100)', () => {
    // ERR_FAIL_COND_MSG covers x || y || z, so one negative refuses the call and
    // the box keeps Vector3(1, 1, 1) rather than a partly-authored size.
    expect(decodeBoxShape3D({ size: 'Vector3(2, -3, 4)' }).size).toEqual({ x: 1, y: 1, z: 1 });
    expect(decodeBoxShape3D({ size: 'Vector3(0, 0, 0)' }).size).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('decodeBoxShape3D on a Godot-3 extents', () => {
  it('reads the doubled size the scan resolved (box_shape_3d.cpp:81-83)', () => {
    // The scan rewrites `extents = Vector3(3, 1, 3)` to `size = Vector3(6, 2, 6)`
    // (godot/deprecated.ts); the decoder reads only the canonical slot.
    expect(decodeBoxShape3D(canonicalisePropertyBag('BoxShape3D', { extents: 'Vector3(3, 1, 3)' })).size).toEqual({
      x: 6,
      y: 2,
      z: 6,
    });
    expect(decodeBoxShape3D({ extents: 'Vector3(3, 1, 3)' }).size).toEqual({ x: 1, y: 1, z: 1 });
  });
});
