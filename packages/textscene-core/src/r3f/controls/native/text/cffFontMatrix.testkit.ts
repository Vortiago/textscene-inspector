/**
 * The test fonts of the CFF `FontMatrix`: a plain box and a box with a stem in 1000 units per em,
 * glyphs 1 and 2, under matrices that shear, stretch, slope, offset and rescale them. A font dict
 * of a CID-keyed font or of a `CFF2` table may hold a matrix of its own.
 */

import { box, cff2Of, fontOf, glyph, ZONES } from './cffHinting.testkit';
import {
  charstring as cs,
  MAX_TWO_BYTE_INTEGER,
  type TestCffFont,
  type TestDictOperand,
} from './sfntCff.testkit';

/** The six operands `a b c d e f` of a `FontMatrix`: a whole number as an integer, the rest, texts included, as reals. */
export function matrixOperands(...values: readonly (number | string)[]): TestDictOperand[] {
  return values.map((value) => {
    if (typeof value === 'string' || !Number.isInteger(value)) return { real: value };
    return Math.abs(value) <= MAX_TWO_BYTE_INTEGER ? { small: value } : value;
  });
}

const GLYPHS = [glyph(box(100, 0, 500, 700)), glyph([0, 20, 660, 20, 'hstem'], box(100, 0, 500, 700))];

/** The two glyphs of `GLYPHS` in a font that has the matrix `fontMatrix` in its Top DICT. */
const withTopMatrix = (...fontMatrix: (number | string)[]): TestCffFont =>
  fontOf(GLYPHS, { blues: ZONES, fontMatrix: matrixOperands(...fontMatrix) });

/** A CID-keyed font: `fdSelect` names the font dict of each glyph, `.notdef` first. */
const cidFont = (
  fontDictMatrices: readonly (readonly TestDictOperand[] | undefined)[],
  fdSelect: readonly number[],
  topMatrix?: readonly TestDictOperand[]
): TestCffFont => fontOf(GLYPHS, { blues: ZONES, fontDictMatrices, fdSelect, fontMatrix: topMatrix });

const HALF_SIZE = matrixOperands(0.0005, 0, 0, 0.0005, 0, 0);

export const SHEARED_FONT = withTopMatrix(0.001, 0, 0.0003, 0.001, 0, 0);
export const STRETCHED_FONT = withTopMatrix(0.002, 0, 0, 0.001, 0, 0);
export const SLOPED_FONT = withTopMatrix(0.001, 0.0002, 0, 0.001, 0, 0);
export const OFFSET_FONT = withTopMatrix(0.001, 0, 0, 0.001, 0.05, 0.02);

/** The matrix of `SHEARED_FONT`, its reals written with exponents. */
export const EXPONENT_FONT = withTopMatrix('1E-3', 0, '3E-4', '1E-3', 0, 0);

/** The offset of `OFFSET_FONT` in the Top DICT of a CID-keyed font whose one font dict has no matrix. */
export const INHERITED_OFFSET_FONT = cidFont(
  [undefined],
  [0, 0, 0],
  matrixOperands(0.001, 0, 0, 0.001, 0.05, 0.02)
);

/** Its font dict's matrix puts 2000 units on an em, the Top DICT's none: 1000 from the `head` table. */
export const HALF_SIZE_FONT = cidFont([HALF_SIZE], [0, 0, 0]);

/** A matrix in a font dict and none in the Top DICT: the font dict's alone applies. */
export const SHEARED_HALF_SIZE_FONT = cidFont([matrixOperands(0.0005, 0, 0.00015, 0.0005, 0, 0)], [0, 0, 0]);

/** A shear in the Top DICT. Glyph 1 is in a font dict with no matrix, glyph 2 in one with a matrix that halves the size. */
export const SHEARED_FONT_DICTS_FONT = cidFont(
  [undefined, matrixOperands(0.5, 0, 0, 0.5, 0, 0)],
  [0, 0, 1],
  matrixOperands(0.001, 0, 0.0003, 0.001, 0, 0)
);

export const CFF2_HALF_SIZE_FONT = cff2Of([cs(...box(100, 0, 500, 700))], { fontDictMatrices: [HALF_SIZE] });
