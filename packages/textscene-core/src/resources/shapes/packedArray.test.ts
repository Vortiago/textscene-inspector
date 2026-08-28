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

describe('packed FLOAT element grammar', () => {
  it('refuses a literal Godot cannot read, instead of taking its prefix', () => {
    // `parseFloat` read `1.2.3` as 1.2 and stored a vertex the file lacks.
    for (const bad of ['1.2.3', '+1', '.5', '0x10']) {
      expect(() => parsePackedVector2Array(`PackedVector2Array(0, 0, ${bad}, 4)`)).toThrow(
        'Invalid number in PackedVector2Array'
      );
    }
  });

  it('throws on a non-finite element rather than substituting a vertex', () => {
    // Legal in the file, undrawable here — but the callers' documented
    // fallback is "draw nothing", and 0 is a vertex the scene never asked for.
    for (const spelling of ['inf', '-inf', 'inf_neg', 'nan']) {
      expect(() => parsePackedVector2Array(`PackedVector2Array(0, 0, ${spelling}, 4)`)).toThrow(
        'Invalid number in PackedVector2Array'
      );
    }
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

  it('reads an element the way Godot narrows it, not the way parseInt stops', () => {
    // `2e1` is a file Godot loads as 20; `parseInt` stopped at the `e`.
    expect(parsePackedInt32Arrays('[PackedInt32Array(2e1, 1.9, -1.9)]')).toEqual([[20, 1, -1]]);
  });

  it('throws on an element Godot cannot read, like its three float siblings', () => {
    expect(() => parsePackedInt32Arrays('[PackedInt32Array(0, 0x10)]')).toThrow(
      'Invalid number in PackedInt32Array'
    );
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

describe('parsePackedInt32Arrays — the bare inner-array spelling', () => {
  it('reads sub-polygons written as plain nested arrays', () => {
    // Measured on 4.6.3: `polygons = [[0, 1, 2], [0, 2, 3]]` on a Polygon2D
    // loads as two sub-polygons. The strict side accepts it (polygon_2d.cpp:720
    // is an untyped ARRAY and `set_polygons` takes `const Array &`), so a
    // constructor-only scan here made the renderer disagree with the linter
    // about the same file, silently: zero iterations, `[]`, and the outline
    // fan-triangulated as one polygon with nothing reported on either layer.
    expect(parsePackedInt32Arrays('[[0, 1, 2], [0, 2, 3]]')).toEqual([
      [0, 1, 2],
      [0, 2, 3],
    ]);
  });

  it('still reads the constructor spellings', () => {
    expect(parsePackedInt32Arrays('[PackedInt32Array(0, 1, 2)]')).toEqual([[0, 1, 2]]);
    expect(
      parsePackedInt32Arrays('Array[PackedInt32Array]([PackedInt32Array(3, 4, 5)])')
    ).toEqual([[3, 4, 5]]);
  });

  it('reads an empty outer array as no sub-polygons', () => {
    expect(parsePackedInt32Arrays('[]')).toEqual([]);
  });

  it('refuses a bare element the tokenizer cannot read', () => {
    expect(() => parsePackedInt32Arrays('[[0, oops, 2]]')).toThrow();
  });
});
