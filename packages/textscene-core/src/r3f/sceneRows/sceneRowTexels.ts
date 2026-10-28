/**
 * What a row of the scene rows holds, in texels: its width, a texel written whole, the rows of a matrix
 * and the halves of a 32-bit mask. The probe rows and the decal rows write through it, and the chunk
 * that reads the rows (`godotSceneRowMask`) takes the same halves. This module imports nothing.
 */

/** The width of a row: a decal's, the widest, whose layout ends its row (`decalRowLayout.ts`). A probe's row pads to it. */
export const SCENE_ROW_TEXELS = 14;

/**
 * Writes `x`, `y`, `z` and `w` as texel `texel` of `row`.
 *
 * @canonical A texel of a scene row written whole
 */
export function setTexel(row: Float32Array, texel: number, x: number, y: number, z: number, w: number): void {
  const at = texel * 4;
  row[at] = x;
  row[at + 1] = y;
  row[at + 2] = z;
  row[at + 3] = w;
}

/**
 * Writes the first three rows of a matrix, from its column-major `elements`, as texels `first` to `first + 2`.
 *
 * @canonical A matrix written as texels of a scene row
 */
export function setMatrixRows(row: Float32Array, first: number, elements: ArrayLike<number>): void {
  for (let i = 0; i < 3; i++)
    setTexel(row, first + i, elements[i]!, elements[4 + i]!, elements[8 + i]!, elements[12 + i]!);
}

/**
 * The low 16 bits of a 32-bit mask. A float holds 24 bits exactly, so the mask goes in two halves.
 *
 * @canonical A 32-bit mask as two 16-bit halves, `lowMaskHalf` and `highMaskHalf`
 */
export function lowMaskHalf(mask: number): number {
  return mask & 0xffff;
}

/** The high 16 bits of a 32-bit mask. */
export function highMaskHalf(mask: number): number {
  return mask >>> 16;
}
