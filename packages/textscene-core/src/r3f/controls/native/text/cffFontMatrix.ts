/**
 * The `FontMatrix` of the Top DICT and of the font dicts of a CFF, the way FreeType uses it:
 * `cff_face_init` (cffobjs.c) normalises each matrix so that its `yy` is 1 and multiplies the matrix
 * of a font dict with that of the Top DICT, and `cff_slot_load` (cffgload.c) scales a glyph by the
 * ratio of the two units per em and transforms its outline by the matrix.
 * `cffFontMatrixOperands.ts` reads the operator.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FIXED_16_16_ONE, ftDivFix, ftMulDiv } from './fontMetrics';
import { transformOutline, type ScaledOutline } from './glyphContours';

/**
 * The matrix of a font dict. The entries are 16.16. The offset is whole units of the outline, which
 * FreeType adds to 26.6 coordinates. The units per em are those the entries leave out.
 */
export interface FontMatrix {
  readonly xx: number;
  readonly yx: number;
  readonly xy: number;
  readonly yy: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly unitsPerEm: number;
}

export function identityFontMatrix(unitsPerEm: number): FontMatrix {
  return { xx: FIXED_16_16_ONE, yx: 0, xy: 0, yy: FIXED_16_16_ONE, offsetX: 0, offsetY: 0, unitsPerEm };
}

/**
 * The matrix with `yy` (`yx` if `yy` is 0) at 1, which moves the scale into the units per em, and
 * its offset in whole units. A font dict that takes the matrix of the Top DICT goes through this
 * a second time, as it does in FreeType, so its offset is 0, or -1 below zero.
 */
function normalised(matrix: FontMatrix): FontMatrix {
  const divisor = matrix.yy ? Math.abs(matrix.yy) : Math.abs(matrix.yx);
  const toWholeUnits = (offset: number) => Math.floor(ftDivFix(offset, divisor) / FIXED_16_16_ONE);
  return {
    xx: ftDivFix(matrix.xx, divisor),
    yx: ftDivFix(matrix.yx, divisor),
    xy: ftDivFix(matrix.xy, divisor),
    yy: ftDivFix(matrix.yy, divisor),
    offsetX: toWholeUnits(matrix.offsetX),
    offsetY: toWholeUnits(matrix.offsetY),
    unitsPerEm: ftDivFix(matrix.unitsPerEm, divisor),
  };
}

/** `top` times `sub` (`FT_Matrix_Multiply_Scaled`), and `sub`'s offset moved by `top`, both at the smaller units per em. */
function multiplied(top: FontMatrix, sub: FontMatrix): FontMatrix {
  const scaling = top.unitsPerEm > 1 && sub.unitsPerEm > 1 ? Math.min(top.unitsPerEm, sub.unitsPerEm) : 1;
  const unit = FIXED_16_16_ONE * scaling;
  const product = (a: number, b: number, c: number, d: number) => ftMulDiv(a, b, unit) + ftMulDiv(c, d, unit);
  return {
    xx: product(top.xx, sub.xx, top.xy, sub.yx),
    yx: product(top.yx, sub.xx, top.yy, sub.yx),
    xy: product(top.xx, sub.xy, top.xy, sub.yy),
    yy: product(top.yx, sub.xy, top.yy, sub.yy),
    offsetX: product(sub.offsetX, top.xx, sub.offsetY, top.xy),
    offsetY: product(sub.offsetX, top.yx, sub.offsetY, top.yy),
    unitsPerEm: ftMulDiv(sub.unitsPerEm, top.unitsPerEm, scaling),
  };
}

/** The matrices of a CFF as `cff_face_init` leaves them. A font with only a Top DICT has its matrix as the one font dict. */
export interface FontMatrices {
  readonly top: FontMatrix;
  readonly fontDicts: readonly FontMatrix[];
}

/**
 * The matrices of the Top DICT and of each font dict, from those the DICTs hold as written
 * (`undefined` for none). A DICT without one takes the Top DICT's, which is the identity at the
 * `head` units per em if it has none. A font dict with one is multiplied with the Top DICT's.
 */
export function resolveFontMatrices(
  topMatrix: FontMatrix | undefined,
  fontDictMatrices: readonly (FontMatrix | undefined)[] | null,
  headUnitsPerEm: number
): FontMatrices {
  const top = normalised(topMatrix ?? identityFontMatrix(headUnitsPerEm));
  const fontDictMatrix = (matrix: FontMatrix | undefined): FontMatrix => {
    if (!matrix) return normalised(top);
    return normalised(topMatrix ? multiplied(top, matrix) : matrix);
  };
  return { top, fontDicts: fontDictMatrices ? fontDictMatrices.map(fontDictMatrix) : [top] };
}

/**
 * The 26.6 scale of a glyph in the font dict with `matrix`: the scale of the Top DICT's units per
 * em, times the ratio of the two. Only a font dict whose units per em differ is scaled (`cff_slot_load`).
 */
export function rescaledOutlineScale(
  outlineScale: number,
  topUnitsPerEm: number,
  matrix: FontMatrix
): number {
  return matrix.unitsPerEm === topUnitsPerEm
    ? outlineScale
    : ftMulDiv(outlineScale, topUnitsPerEm, matrix.unitsPerEm);
}

/**
 * The outline moved by `matrix` (`FT_Outline_Transform`, then `FT_Outline_Translate` by the
 * offset, which FreeType adds to 26.6 coordinates as it is), in place. The identity leaves it alone.
 */
export function applyFontMatrix(outline: ScaledOutline, matrix: FontMatrix): void {
  const { xx, yx, xy, yy, offsetX, offsetY } = matrix;
  if (xx !== FIXED_16_16_ONE || yy !== FIXED_16_16_ONE || xy !== 0 || yx !== 0) {
    transformOutline(outline, [xx, xy, yx, yy]);
  }
  if (!offsetX && !offsetY) return;
  for (let i = 0; i < outline.x.length; i++) {
    outline.x[i] = outline.x[i]! + offsetX;
    outline.y[i] = outline.y[i]! + offsetY;
  }
}
