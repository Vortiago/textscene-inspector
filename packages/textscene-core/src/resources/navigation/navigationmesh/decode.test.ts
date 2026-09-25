import { describe, expect, it } from 'vitest';
import { decodeNavigationMesh } from './decode';

describe('decodeNavigationMesh', () => {
  it('decodes the vertices + polygons of a two-triangle navmesh (happy path)', () => {
    const data = decodeNavigationMesh({
      vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1)',
      polygons: '[PackedInt32Array(0, 1, 2), PackedInt32Array(0, 2, 3)]',
    });
    expect(Array.from(data!.vertices)).toEqual([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]);
    expect(data!.polygons).toEqual([
      [0, 1, 2],
      [0, 2, 3],
    ]);
  });

  it('keeps an n-gon polygon whole rather than pre-triangulating it', () => {
    // The consumer fan-triangulates from index 0, matching Godot's own
    // Face3(v[0], v[j-1], v[j]) sweep.
    const data = decodeNavigationMesh({
      vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1)',
      polygons: '[PackedInt32Array(0, 1, 2, 3)]',
    });
    expect(data!.polygons).toEqual([[0, 1, 2, 3]]);
  });

  it('also reads the typed `Array[PackedInt32Array](…)` wrapper (format tolerance)', () => {
    // NavigationMesh::_get_polygons returns an untyped Array, so Godot writes the
    // bare form. The typed spelling its 2D sibling emits is accepted too.
    const data = decodeNavigationMesh({
      vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)',
      polygons: 'Array[PackedInt32Array]([PackedInt32Array(0, 1, 2)])',
    });
    expect(data!.polygons).toEqual([[0, 1, 2]]);
  });

  it('returns null when either property is absent (error path)', () => {
    expect(decodeNavigationMesh({})).toBeNull();
    expect(
      decodeNavigationMesh({ vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)' })
    ).toBeNull();
    expect(decodeNavigationMesh({ polygons: '[PackedInt32Array(0, 1, 2)]' })).toBeNull();
  });

  it('returns null instead of throwing on malformed POLYGON indices', () => {
    // The index reader throws on an element Godot's tokenizer refuses, and this
    // call sits outside the vertices try/catch, so without its own guard the
    // throw leaves the decoder and takes the previewer down with it.
    expect(
      decodeNavigationMesh({
        vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)',
        polygons: '[PackedInt32Array(0, 0x10, 2)]',
      })
    ).toBeNull();
  });

  it('returns null instead of throwing on malformed vertices (error path)', () => {
    expect(
      decodeNavigationMesh({
        vertices: 'PackedVector3Array(0, 0, oops)',
        polygons: '[PackedInt32Array(0, 1, 2)]',
      })
    ).toBeNull();
    expect(
      decodeNavigationMesh({
        vertices: 'PackedVector2Array(0, 0, 1, 0, 1, 1)',
        polygons: '[PackedInt32Array(0, 1, 2)]',
      })
    ).toBeNull();
  });

  it('returns null when a property is not a Godot-text literal at all (error path)', () => {
    // An inline `[sub_resource]`'s data is `Record<string, unknown>`, and a non-string
    // there decodes to nothing rather than being coerced.
    expect(
      decodeNavigationMesh({ vertices: null, polygons: '[PackedInt32Array(0, 1, 2)]' })
    ).toBeNull();
  });

  it('returns null for empty arrays (edge case)', () => {
    expect(
      decodeNavigationMesh({
        vertices: 'PackedVector3Array()',
        polygons: '[PackedInt32Array(0, 1, 2)]',
      })
    ).toBeNull();
    expect(
      decodeNavigationMesh({
        vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)',
        polygons: '[]',
      })
    ).toBeNull();
  });

  it('drops undrawable polygons and nulls out when none survive (edge case)', () => {
    const partial = decodeNavigationMesh({
      vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)',
      polygons: '[PackedInt32Array(0, 1), PackedInt32Array(0, 1, 2)]',
    });
    expect(partial!.polygons).toEqual([[0, 1, 2]]);

    const outOfRange = decodeNavigationMesh({
      vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)',
      polygons: '[PackedInt32Array(0, 1, 5)]',
    });
    expect(outOfRange).toBeNull();
  });

  it('draws no navmesh for a non-finite vertex, rather than a degenerate one', () => {
    expect(
      decodeNavigationMesh({
        vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, inf, 0, 1)',
        polygons: '[PackedInt32Array(0, 1, 2)]',
      })
    ).toBeNull();
  });

  it('ignores a trailing partial vertex when range-checking indices (edge case)', () => {
    // Eight floats describe two vertices and a stray pair, so index 2 must not resolve.
    expect(
      decodeNavigationMesh({
        vertices: 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0)',
        polygons: '[PackedInt32Array(0, 1, 2)]',
      })
    ).toBeNull();
  });
});
