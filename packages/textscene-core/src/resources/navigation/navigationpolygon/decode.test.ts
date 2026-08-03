import { describe, expect, it } from 'vitest';
import { decodeNavigationPolygon } from './decode';

describe('decodeNavigationPolygon', () => {
  it('decodes the vertices + polygons of a square region (happy path)', () => {
    const data = decodeNavigationPolygon({
      vertices: 'PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)',
      polygons: 'Array[PackedInt32Array]([PackedInt32Array(0, 1, 2, 3)])',
    });
    expect(Array.from(data!.vertices)).toEqual([0, 0, 64, 0, 64, 64, 0, 64]);
    expect(data!.polygons).toEqual([[0, 1, 2, 3]]);
  });

  it('keeps vertices in raw Godot 2D space (+Y down, unnegated)', () => {
    // The Y flip belongs to the render adapter (navigationOverlay.vector2ToPositions);
    // negating here would mirror every navmesh about its region origin.
    const data = decodeNavigationPolygon({
      vertices: 'PackedVector2Array(0, 0, 10, 32, 0, 32)',
      polygons: 'Array[PackedInt32Array]([PackedInt32Array(0, 1, 2)])',
    });
    expect(data!.vertices[3]).toBe(32);
  });

  it('decodes several polygons sharing a vertex pool', () => {
    const data = decodeNavigationPolygon({
      vertices: 'PackedVector2Array(0, 0, 8, 0, 8, 8, 0, 8)',
      polygons:
        'Array[PackedInt32Array]([PackedInt32Array(0, 1, 2), PackedInt32Array(0, 2, 3)])',
    });
    expect(data!.polygons).toEqual([
      [0, 1, 2],
      [0, 2, 3],
    ]);
  });

  it('also reads the bare `[PackedInt32Array(...)]` wrapper (format tolerance)', () => {
    // NavigationPolygon::_get_polygons returns a TypedArray, so Godot writes the
    // `Array[PackedInt32Array](…)` form; the untyped form is accepted anyway
    // rather than making the wrapper spelling load-bearing.
    const data = decodeNavigationPolygon({
      vertices: 'PackedVector2Array(0, 0, 4, 0, 4, 4)',
      polygons: '[PackedInt32Array(0, 1, 2)]',
    });
    expect(data!.polygons).toEqual([[0, 1, 2]]);
  });

  it('returns null when either property is absent (error path)', () => {
    expect(decodeNavigationPolygon({})).toBeNull();
    expect(
      decodeNavigationPolygon({ vertices: 'PackedVector2Array(0, 0, 1, 0, 1, 1)' })
    ).toBeNull();
    expect(
      decodeNavigationPolygon({ polygons: '[PackedInt32Array(0, 1, 2)]' })
    ).toBeNull();
  });

  it('returns null instead of throwing on malformed vertices (error path)', () => {
    expect(
      decodeNavigationPolygon({
        vertices: 'PackedVector2Array(0, nope, 1)',
        polygons: '[PackedInt32Array(0, 1, 2)]',
      })
    ).toBeNull();
    expect(
      decodeNavigationPolygon({
        vertices: 'Vector2(0, 0)',
        polygons: '[PackedInt32Array(0, 1, 2)]',
      })
    ).toBeNull();
  });

  it('returns null when a property is not a Godot-text literal at all (error path)', () => {
    // An inline `[sub_resource]`'s data is `Record<string, unknown>`; a non-string
    // there decodes to nothing rather than being coerced.
    expect(
      decodeNavigationPolygon({ vertices: 42, polygons: '[PackedInt32Array(0, 1, 2)]' })
    ).toBeNull();
  });

  it('returns null for empty arrays (edge case)', () => {
    expect(
      decodeNavigationPolygon({
        vertices: 'PackedVector2Array()',
        polygons: '[PackedInt32Array(0, 1, 2)]',
      })
    ).toBeNull();
    expect(
      decodeNavigationPolygon({
        vertices: 'PackedVector2Array(0, 0, 1, 0, 1, 1)',
        polygons: 'Array[PackedInt32Array]([])',
      })
    ).toBeNull();
  });

  it('drops undrawable polygons and nulls out when none survive (edge case)', () => {
    const partial = decodeNavigationPolygon({
      vertices: 'PackedVector2Array(0, 0, 4, 0, 4, 4)',
      polygons: '[PackedInt32Array(0, 1), PackedInt32Array(0, 1, 2)]',
    });
    expect(partial!.polygons).toEqual([[0, 1, 2]]);

    const outOfRange = decodeNavigationPolygon({
      vertices: 'PackedVector2Array(0, 0, 4, 0, 4, 4)',
      polygons: '[PackedInt32Array(0, 1, 7)]',
    });
    expect(outOfRange).toBeNull();
  });

  it('ignores a trailing half vertex when range-checking indices (edge case)', () => {
    // Five floats describe two vertices and a stray x; index 2 must not resolve.
    const data = decodeNavigationPolygon({
      vertices: 'PackedVector2Array(0, 0, 4, 0, 4)',
      polygons: '[PackedInt32Array(0, 1, 2)]',
    });
    expect(data).toBeNull();
  });
});
