/**
 * How many uniform vectors a program's uniforms take under the packing rule of GLSL ES 1.00
 * Appendix A.7, as ANGLE's `VariablePacker` applies it to a WebGL program. The answer is the fewest
 * rows the rule fits the uniforms into, so it compares with `MAX_FRAGMENT_UNIFORM_VECTORS`.
 */

const COLUMNS = 4;

/**
 * Each WebGL 2 non-sampler uniform type, as `getActiveUniform` reports it, and `[columns, rows]` of
 * one element, as ANGLE's `GetTypePackingComponentsPerRow` and `GetTypePackingRows` give them
 * (`compiler/translator/VariablePacker.cpp`). A non-square matrix takes the space of the square
 * one of its larger side, and a mat2 takes two full rows.
 */
const TYPES = {
  FLOAT: [0x1406, 1, 1],
  FLOAT_VEC2: [0x8b50, 2, 1],
  FLOAT_VEC3: [0x8b51, 3, 1],
  FLOAT_VEC4: [0x8b52, 4, 1],
  INT: [0x1404, 1, 1],
  INT_VEC2: [0x8b53, 2, 1],
  INT_VEC3: [0x8b54, 3, 1],
  INT_VEC4: [0x8b55, 4, 1],
  UNSIGNED_INT: [0x1405, 1, 1],
  UNSIGNED_INT_VEC2: [0x8dc6, 2, 1],
  UNSIGNED_INT_VEC3: [0x8dc7, 3, 1],
  UNSIGNED_INT_VEC4: [0x8dc8, 4, 1],
  BOOL: [0x8b56, 1, 1],
  BOOL_VEC2: [0x8b57, 2, 1],
  BOOL_VEC3: [0x8b58, 3, 1],
  BOOL_VEC4: [0x8b59, 4, 1],
  FLOAT_MAT2: [0x8b5a, 4, 2],
  FLOAT_MAT3: [0x8b5b, 3, 3],
  FLOAT_MAT4: [0x8b5c, 4, 4],
  FLOAT_MAT2x3: [0x8b65, 3, 3],
  FLOAT_MAT2x4: [0x8b66, 4, 4],
  FLOAT_MAT3x2: [0x8b67, 3, 3],
  FLOAT_MAT3x4: [0x8b68, 4, 4],
  FLOAT_MAT4x2: [0x8b69, 4, 4],
  FLOAT_MAT4x3: [0x8b6a, 4, 4],
};

/** Each type's code by its name. */
export const UNIFORM_SHAPES = Object.fromEntries(Object.entries(TYPES).map(([name, [code]]) => [name, code]));

const SHAPES = new Map(Object.values(TYPES).map(([code, columns, rows]) => [code, [columns, rows]]));

/** `{ columns, rows, size }` of a whole uniform, array elements included. */
function footprint({ type, size }) {
  const shape = SHAPES.get(type);
  if (!shape) throw new Error(`no packing shape for uniform type 0x${type.toString(16)}`);
  return { columns: shape[0], rows: shape[1] * size, size };
}

/** @param {{ type: number, size: number }[]} uniforms - each as `getActiveUniform` reports it. */
export function packedVectors(uniforms) {
  // Within a width, A.7 packs the largest array first.
  const footprints = uniforms.map(footprint).sort((a, b) => b.size - a.size);
  const lowerBound = Math.ceil(
    footprints.reduce((sum, { columns, rows }) => sum + columns * rows, 0) / COLUMNS
  );
  for (let maxRows = lowerBound; ; maxRows++) {
    if (fits(footprints, maxRows)) return maxRows;
  }
}

/**
 * Whether A.7 packs `footprints` into `maxRows` rows, as ANGLE's
 * `checkExpandedVariablesWithinPackingLimits` does: four columns, then three, two and one.
 */
function fits(footprints, maxRows) {
  const grid = Array.from({ length: maxRows }, () => new Array(COLUMNS).fill(false));
  const rowsOf = (columns) => footprints.filter((each) => each.columns === columns).map(({ rows }) => rows);
  const fill = (top, count, column, width) => {
    for (let row = top; row < top + count; row++) {
      for (let c = column; c < column + width; c++) grid[row][c] = true;
    }
  };

  const fullRows = sum(rowsOf(4));
  const threeColumnRows = sum(rowsOf(3));
  if (fullRows + threeColumnRows > maxRows) return false;
  fill(0, fullRows, 0, 4);
  fill(fullRows, threeColumnRows, 0, 3);

  const twoColumnTop = fullRows + threeColumnRows;
  const twoColumnRows = maxRows - twoColumnTop;
  let free01 = twoColumnRows;
  let free23 = twoColumnRows;
  for (const rows of rowsOf(2)) {
    if (rows <= free01) free01 -= rows;
    else if (rows <= free23) free23 -= rows;
    else return false;
  }
  fill(twoColumnTop, twoColumnRows - free01, 0, 2);
  fill(maxRows - (twoColumnRows - free23), twoColumnRows - free23, 2, 2);

  for (const rows of rowsOf(1)) {
    const slot = smallestFreeRun(grid, fullRows, rows);
    if (!slot) return false;
    fill(slot.top, rows, slot.column, 1);
  }
  return true;
}

/** The smallest run of free rows in any column, from `top` down, that holds `rows`. */
function smallestFreeRun(grid, top, rows) {
  let best = null;
  for (let column = 0; column < COLUMNS; column++) {
    let runTop = -1;
    for (let row = top; row <= grid.length; row++) {
      const isFree = row < grid.length && !grid[row][column];
      if (isFree && runTop < 0) runTop = row;
      if (isFree || runTop < 0) continue;
      const size = row - runTop;
      if (size >= rows && (!best || size < best.size)) best = { column, top: runTop, size };
      runTop = -1;
    }
  }
  return best;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

/** Every WebGL 2 sampler type, which takes a texture unit and no uniform vector. */
const SAMPLER_TYPES = new Set([
  0x8b5e, 0x8b5f, 0x8b60, 0x8b62, 0x8dc1, 0x8dc4, 0x8dc5, 0x8dca, 0x8dcb, 0x8dcc, 0x8dcf, 0x8dd2, 0x8dd3,
  0x8dd4, 0x8dd7,
]);

export function isSampler(type) {
  return SAMPLER_TYPES.has(type);
}
