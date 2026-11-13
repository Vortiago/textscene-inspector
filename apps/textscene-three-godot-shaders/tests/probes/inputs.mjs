/**
 * The input tables of the probes. Each value is a JavaScript number that a probe passes to the
 * GPU as the bits of the nearest 32-bit float, so `-0`, a subnormal, the infinities and NaN reach
 * the instruction unchanged.
 */

/**
 * The float inputs: zero of both signs, small and large of both signs, a value with no exact
 * binary form, a subnormal, the largest float, the infinities and NaN.
 */
export const FLOAT_VALUES = [
  0,
  -0,
  1,
  -1,
  0.5,
  -2.75,
  1 / 3,
  1e-7,
  123456.789,
  16777217,
  3e38,
  -3e38,
  1e-40,
  Infinity,
  -Infinity,
  NaN,
];

/** Each float input alone, one row per value. */
export function scalars() {
  return FLOAT_VALUES.map((value) => [value]);
}

/** Every ordered pair of float inputs. */
export function pairs() {
  return FLOAT_VALUES.flatMap((a) => FLOAT_VALUES.map((b) => [a, b]));
}

/** A lane offset that is prime to the input count, so the lanes of a row hold different values. */
const LANE_STRIDE = 5;

/**
 * The argument offsets of the two blocks of rows, apart from the lane offsets and from each other,
 * so the second block pairs each value with other partners than the first.
 */
const ARGUMENT_STRIDES = [7, 11];

/** The value of lane `lane` of argument `argument` in row `row`. */
function valueAt(row, argument, lane) {
  const stride = ARGUMENT_STRIDES[Math.floor(row / FLOAT_VALUES.length)];
  const index = (row + argument * stride + lane * LANE_STRIDE) % FLOAT_VALUES.length;
  return FLOAT_VALUES[index];
}

/** One row per float input, each a vector of `size` lanes. */
export function vectors(size) {
  return FLOAT_VALUES.map((_, row) => [lanes(row, 0, size)]);
}

/**
 * Rows of arguments of the given sizes, a float for size 1 and a vector otherwise: one block of
 * rows per argument offset, with a row that repeats an earlier one left out.
 */
export function pairedVectors(sizes) {
  const rowCount = FLOAT_VALUES.length * ARGUMENT_STRIDES.length;
  const rows = Array.from({ length: rowCount }, (_, row) =>
    sizes.map((size, argument) => lanes(row, argument, size))
  );
  const seen = new Set();
  return rows.filter((row) => {
    const key = JSON.stringify(row.map((argument) => [argument].flat().map(floatBits)));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lanes(row, argument, size) {
  const values = Array.from({ length: size }, (_, lane) => valueAt(row, argument, lane));
  return size === 1 ? values[0] : values;
}

const float32 = new Float32Array(1);
const bits32 = new Uint32Array(float32.buffer);

/** The bits of the 32-bit float nearest `value`, as Godot and the GPU hold it. */
export function floatBits(value) {
  float32[0] = value;
  return bits32[0];
}

/** The float that `bits` hold. */
export function floatOfBits(bits) {
  bits32[0] = bits;
  return float32[0];
}

/** The lanes of an argument, a float as one lane. */
export function lanesOf(argument) {
  return Array.isArray(argument) ? argument : [argument];
}
