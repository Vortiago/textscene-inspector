/**
 * Packed-array parsers shared by shape/navigation resources. Test data is real
 * Godot navigation syntax: 3D `polygons = [PackedInt32Array(...), ...]` and 2D
 * `polygons = Array[PackedInt32Array]([...])` / `outlines = Array[PackedVector2Array]([...])`.
 */
import { describe, it, expect } from 'vitest';
import {
  parsePackedVector2Array,
  parsePackedVector3Array,
  parsePackedInt32Arrays,
  fanTriangulate,
} from './packedArray';

describe('parsePackedVector3Array', () => {
  it('parses flat x,y,z triples', () => {
    expect(Array.from(parsePackedVector3Array('PackedVector3Array(1, 2, 3, 4, 5, 6)'))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
});

describe('parsePackedVector2Array', () => {
  it('parses flat x,y pairs', () => {
    const out = parsePackedVector2Array('PackedVector2Array(481.5, 294.25, 459.0, 269.5)');
    expect(Array.from(out)).toEqual([481.5, 294.25, 459.0, 269.5]);
  });

  it('returns empty for an empty array', () => {
    expect(parsePackedVector2Array('PackedVector2Array()')).toHaveLength(0);
  });
});

describe('parsePackedInt32Arrays', () => {
  it('extracts each PackedInt32Array from a bare 3D polygon list', () => {
    const out = parsePackedInt32Arrays('[PackedInt32Array(2, 1, 3), PackedInt32Array(3, 1, 0)]');
    expect(out).toEqual([
      [2, 1, 3],
      [3, 1, 0],
    ]);
  });

  it('extracts from the 2D Array[PackedInt32Array]([...]) wrapper form', () => {
    const out = parsePackedInt32Arrays(
      'Array[PackedInt32Array]([PackedInt32Array(0, 1, 2, 3), PackedInt32Array(4, 5, 6, 7, 8)])'
    );
    expect(out).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7, 8],
    ]);
  });

  it('returns no polygons for an empty list', () => {
    expect(parsePackedInt32Arrays('[]')).toEqual([]);
  });
});

describe('fanTriangulate', () => {
  it('passes a triangle through unchanged', () => {
    expect(fanTriangulate([2, 1, 3])).toEqual([2, 1, 3]);
  });

  it('fans a quad into two triangles', () => {
    expect(fanTriangulate([0, 1, 2, 3])).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('fans a pentagon into three triangles', () => {
    expect(fanTriangulate([4, 5, 6, 7, 8])).toEqual([4, 5, 6, 4, 6, 7, 4, 7, 8]);
  });

  it('drops degenerate polygons with fewer than 3 indices', () => {
    expect(fanTriangulate([0, 1])).toEqual([]);
  });
});
