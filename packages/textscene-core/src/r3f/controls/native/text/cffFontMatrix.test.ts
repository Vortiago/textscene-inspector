/**
 * Every expectation is what Godot's text server returned for the same font bytes
 * (`font_get_glyph_contours` of Godot 4.6.3 at 13 px). The test fonts have 1000 units per em in
 * their `head` table, so a matrix that is not the identity, or that puts another number of units
 * on an em, shows in the points.
 */

import { describe, expect, it } from 'vitest';
import { readFontMatrixEntry } from './cffFontMatrix';
import {
  CFF2_HALF_SIZE_FONT,
  EXPONENT_FONT,
  HALF_SIZE_FONT,
  INHERITED_OFFSET_FONT,
  OFFSET_FONT,
  SHEARED_FONT,
  SHEARED_FONT_DICTS_FONT,
  SHEARED_HALF_SIZE_FONT,
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

/**
 * The entries `cff_parse_font_matrix` reads, from its source. A glyph drawn under the default matrix
 * it falls back to looks the same, so Godot does not show them.
 */
describe('reading the operands of a FontMatrix', () => {
  const entryOf = (...values: (number | string)[]) => {
    const bytes: number[] = [];
    const starts = matrixOperands(...values).map((operand) => {
      const at = bytes.length;
      bytes.push(...dictOperandBytes(operand));
      return at;
    });
    return readFontMatrixEntry(new DataView(new Uint8Array(bytes).buffer), starts, bytes.length);
  };
  const DEFAULT_ENTRY = [65536, 0, 0, 65536, 0, 0, 1];

  it('keeps the operands at the one scale that fits the largest, and the scale as units per em', () => {
    expect(entryOf(0.001, 0, 0.0003, 0.001, 0.05, 0.02)).toEqual([6554, 0, 1966, 6554, 327680, 131072, 100]);
  });

  it('falls back to the default matrix for operands that differ by more than nine powers of ten', () => {
    expect(entryOf(0.001, 0, 0, 0.001, 1e-13, 0)).toEqual(DEFAULT_ENTRY);
  });

  it('falls back to the default matrix for operands larger than a 16.16 number', () => {
    expect(entryOf(100000, 0, 0, 100000, 0, 0)).toEqual(DEFAULT_ENTRY);
  });

  it('falls back to the default matrix for a matrix without a determinant', () => {
    expect(entryOf(0.001, 0, 0.001, 0, 0, 0)).toEqual(DEFAULT_ENTRY);
  });

  it('falls back to the default matrix for operands that are all zero', () => {
    expect(entryOf(0, 0, 0, 0, 0, 0)).toEqual(DEFAULT_ENTRY);
  });

  it('reads no matrix from fewer than six operands', () => {
    expect(entryOf(0.001, 0, 0, 0.001, 0)).toBeNull();
  });
});
