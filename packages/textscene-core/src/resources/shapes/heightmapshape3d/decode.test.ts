/** Tests for the HeightMapShape3D decode: the setters of `height_map_shape_3d.cpp`, replayed in file order. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeHeightMapShape3D } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

function decoded(properties: Record<string, string>) {
  const { width, depth, heights } = decodeHeightMapShape3D(properties);
  return { width, depth, heights: Array.from(heights) };
}

describe('decodeHeightMapShape3D', () => {
  // Constructor: `map_width = map_depth = 2` (`height_map_shape_3d.h:41-42`), four zero heights (`height_map_shape_3d.cpp:361-369`).
  it('is a flat 2 x 2 grid when nothing is authored, silently', () => {
    expect(decoded({})).toEqual({ width: 2, depth: 2, heights: [0, 0, 0, 0] });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('honours an authored width, depth and heights', () => {
    expect(
      decoded({
        map_width: '3',
        map_depth: '2',
        map_data: 'PackedFloat32Array(0, 1, 2, 3, 4, 5)',
      })
    ).toEqual({ width: 3, depth: 2, heights: [0, 1, 2, 3, 4, 5] });
  });

  // `set_map_width` / `set_map_depth` resize and zero-fill (`height_map_shape_3d.cpp:155-201`).
  it('zero-fills the heights a larger grid adds', () => {
    expect(decoded({ map_width: '3' })).toEqual({ width: 3, depth: 2, heights: [0, 0, 0, 0, 0, 0] });
  });

  // `set_map_data` returns without copying unless the size matches (`:203-206`).
  it('ignores heights whose count is not width x depth', () => {
    expect(decoded({ map_data: 'PackedFloat32Array(1, 2, 3)' }).heights).toEqual([0, 0, 0, 0]);
  });

  it('ignores heights that come before the width that makes them fit', () => {
    expect(decoded({ map_data: 'PackedFloat32Array(1, 2, 3, 4, 5, 6)', map_width: '3' }).heights).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
  });

  it('keeps the heights a later, smaller grid truncates', () => {
    expect(
      decoded({
        map_width: '3',
        map_data: 'PackedFloat32Array(1, 2, 3, 4, 5, 6)',
        map_depth: '1',
      })
    ).toEqual({ width: 3, depth: 1, heights: [1, 2, 3] });
  });

  // `set_map_width` ignores a value below one (`:156`).
  it.each(['0', '-4'])('ignores a width or depth of %s', (size) => {
    expect(decoded({ map_width: size, map_depth: size })).toEqual({
      width: 2,
      depth: 2,
      heights: [0, 0, 0, 0],
    });
  });

  it('stores heights as authored, negative and large included', () => {
    expect(decoded({ map_data: 'PackedFloat32Array(-3, 0, 250, 0.5)' }).heights).toEqual([-3, 0, 250, 0.5]);
  });

  it('warns then keeps the grid for malformed values', () => {
    expect(decoded({ map_width: 'nope', map_data: 'not-an-array' })).toEqual({
      width: 2,
      depth: 2,
      heights: [0, 0, 0, 0],
    });
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
