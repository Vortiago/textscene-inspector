/**
 * Every expectation is what Godot's text server returned for the same font bytes
 * (`font_get_glyph_contours` of Godot 4.6.3 at 13 px). The test fonts have 1000 units per em in
 * their `head` table, so a matrix that is not the identity, or that puts another number of units
 * on an em, shows in the points.
 */

import { describe, expect, it } from 'vitest';
import { readFontMatrix } from './cffFontMatrixOperands';
import {
  CFF2_HALF_SIZE_FONT,
  EMPTY_FONT_DICTS_FONT,
  EXPONENT_FONT,
  FORMAT_0_FONT,
  HALF_SIZE_FONT,
  INHERITED_OFFSET_FONT,
  MISSING_FONT_DICT_FONT,
  OFFSET_FONT,
  SHEARED_FONT,
  SHEARED_FONT_DICTS_FONT,
  SHEARED_HALF_SIZE_FONT,
  SHORT_MATRIX_FONT,
  SLOPED_FONT,
  STRETCHED_FONT,
  matrixOperands,
} from './cffFontMatrix.testkit';
import { dictOperandBytes, drawnAt } from './sfntCff.testkit';

describe('the FontMatrix of the Top DICT', () => {
  it('shears a glyph by the matrix after it is hinted', () => {
    expect(drawnAt(SHEARED_FONT, 1, 13)).toEqual(['1.296875,0 6.5,0 9.234375,-9.09375 4.03125,-9.09375']);
    expect(drawnAt(SHEARED_FONT, 2, 13)).toEqual(['1.296875,0 6.5,0 9.5,-10 4.296875,-10']);
  });

  it('stretches a glyph in x by the ratio of the first two diagonal entries', () => {
    expect(drawnAt(STRETCHED_FONT, 1, 13)).toEqual(['2.59375,0 13,0 13,-9.09375 2.59375,-9.09375']);
  });

  it('slopes a glyph in y by an entry that moves y with x', () => {
    expect(drawnAt(SLOPED_FONT, 1, 13)).toEqual([
      '1.296875,-0.265625 6.5,-1.296875 6.5,-10.390625 1.296875,-9.359375',
    ]);
  });

  it('moves a glyph by the offset in whole 26.6 units', () => {
    expect(drawnAt(OFFSET_FONT, 1, 13)).toEqual([
      '2.0625,-0.296875 7.265625,-0.296875 7.265625,-9.390625 2.0625,-9.390625',
    ]);
  });

  it('reads the reals of a matrix that are written with exponents', () => {
    expect(drawnAt(EXPONENT_FONT, 1, 13)).toEqual(['1.296875,0 6.5,0 9.234375,-9.09375 4.03125,-9.09375']);
  });
});

describe('the FontMatrix of a font dict', () => {
  it('scales a glyph by the units per em of the matrix of its font dict, hints included', () => {
    expect(drawnAt(HALF_SIZE_FONT, 1, 13)).toEqual(['0.640625,0 3.25,0 3.25,-4.546875 0.640625,-4.546875']);
    expect(drawnAt(HALF_SIZE_FONT, 2, 13)).toEqual(['0.640625,0 3.25,0 3.25,-5 0.640625,-5']);
  });

  it('shears a glyph by the matrix of its font dict when the Top DICT has none', () => {
    expect(drawnAt(SHEARED_HALF_SIZE_FONT, 1, 13)).toEqual([
      '0.640625,0 3.25,0 4.609375,-4.546875 2,-4.546875',
    ]);
  });

  it('gives a font dict without a matrix the matrix of the Top DICT', () => {
    expect(drawnAt(SHEARED_FONT_DICTS_FONT, 1, 13)).toEqual([
      '1.296875,0 6.5,0 9.234375,-9.09375 4.03125,-9.09375',
    ]);
  });

  it('loses the offset of the Top DICT in a font dict that takes the matrix of the Top DICT', () => {
    expect(drawnAt(INHERITED_OFFSET_FONT, 1, 13)).toEqual([
      '1.296875,0 6.5,0 6.5,-9.09375 1.296875,-9.09375',
    ]);
  });

  it('multiplies the matrix of a font dict with the matrix of the Top DICT', () => {
    expect(drawnAt(SHEARED_FONT_DICTS_FONT, 2, 13)).toEqual(['0.640625,0 3.25,0 4.75,-5 2.140625,-5']);
  });

  it('scales a glyph of a CFF2 font by the matrix of its font dict', () => {
    expect(drawnAt(CFF2_HALF_SIZE_FONT, 1, 13)).toEqual([
      '0.640625,0 3.25,0 3.25,-4.546875 0.640625,-4.546875',
    ]);
  });
});

describe('the font dicts of a CFF that FreeType repairs or refuses', () => {
  it('draws with the Top DICT when the FDArray is empty', () => {
    expect(drawnAt(EMPTY_FONT_DICTS_FONT, 1, 13)).toEqual([
      '1.296875,0 6.5,0 9.234375,-9.09375 4.03125,-9.09375',
    ]);
    expect(drawnAt(EMPTY_FONT_DICTS_FONT, 2, 13)).toEqual(['1.296875,0 6.5,0 9.203125,-9 4,-9']);
  });

  it('draws no glyph whose FDSelect names a font dict the font lacks', () => {
    expect(drawnAt(MISSING_FONT_DICT_FONT, 1, 13)).toEqual([
      '1.296875,0 6.5,0 6.5,-9.09375 1.296875,-9.09375',
    ]);
    expect(drawnAt(MISSING_FONT_DICT_FONT, 2, 13)).toBeNull();
  });

  it('reads an FDSelect of format 0', () => {
    expect(drawnAt(FORMAT_0_FONT, 2, 13)).toEqual(['1.296875,0 6.5,0 6.5,-10 1.296875,-10']);
  });

  it('opens no font whose FontMatrix has fewer than six operands', () => {
    expect(drawnAt(SHORT_MATRIX_FONT, 1, 13)).toBeNull();
  });
});

/**
 * The entries `cff_parse_font_matrix` reads, from its source. A glyph drawn under the default matrix
 * it falls back to looks the same, so Godot does not show them.
 */
describe('reading the operands of a FontMatrix', () => {
  const matrixOf = (...values: (number | string)[]) => {
    const bytes: number[] = [];
    const starts = matrixOperands(...values).map((operand) => {
      const at = bytes.length;
      bytes.push(...dictOperandBytes(operand));
      return at;
    });
    return readFontMatrix(
      new DataView(new Uint8Array(bytes).buffer),
      values.map(Number),
      starts,
      bytes.length
    );
  };
  const DEFAULT_MATRIX = { xx: 65536, yx: 0, xy: 0, yy: 65536, offsetX: 0, offsetY: 0, unitsPerEm: 1 };

  it('keeps the operands at the one scale that fits the largest, and the scale as units per em', () => {
    expect(matrixOf(0.001, 0, 0.0003, 0.001, 0.05, 0.02)).toEqual({
      xx: 6554,
      yx: 0,
      xy: 1966,
      yy: 6554,
      offsetX: 327680,
      offsetY: 131072,
      unitsPerEm: 100,
    });
  });

  it.each([
    ['operands that differ by more than nine powers of ten', [0.001, 0, 0, 0.001, 1e-13, 0]],
    ['operands larger than a 16.16 number', [100000, 0, 0, 100000, 0, 0]],
    ['a matrix without a determinant', [0.001, 0, 0.001, 0, 0, 0]],
    ['operands that are all zero', [0, 0, 0, 0, 0, 0]],
  ])('falls back to the default matrix for %s', (_, values) => {
    expect(matrixOf(...values)).toEqual(DEFAULT_MATRIX);
  });

  it('reads no matrix from fewer than six operands', () => {
    expect(matrixOf(0.001, 0, 0, 0.001, 0)).toBeNull();
  });
});
