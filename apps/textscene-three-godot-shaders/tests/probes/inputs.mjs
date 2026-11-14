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

/** The value of lane `lane` of argument `argument` in row `row`, from the table of `scalar` kind. */
function valueAt(scalar, row, argument, lane) {
  const values = VALUES[scalar];
  const stride = ARGUMENT_STRIDES[Math.floor(row / values.length)];
  const index = (row + argument * stride + lane * LANE_STRIDE) % values.length;
  return values[index];
}

/** One row per float input, each a vector of `size` lanes. */
export function vectors(size) {
  return FLOAT_VALUES.map((_, row) => [lanes('float', row, 0, size)]);
}

/** Rows of float arguments of the given sizes, a float for size 1 and a vector otherwise. */
export function pairedVectors(sizes) {
  return argumentRows(sizes.map((size) => ({ scalar: 'float', lanes: size })));
}

/**
 * Rows of arguments of the given shapes, `{ scalar, lanes }`, one value for one lane and a list
 * otherwise: one block of rows per argument offset, with a row that repeats an earlier one left out.
 */
export function argumentRows(shapes) {
  const rowCount = FLOAT_VALUES.length * ARGUMENT_STRIDES.length;
  const rows = Array.from({ length: rowCount }, (_, row) =>
    shapes.map((shape, argument) => lanes(shape.scalar, row, argument, shape.lanes))
  );
  const seen = new Set();
  return rows.filter((row) => {
    const key = JSON.stringify(
      row.map((argument, index) => [argument].flat().map((value) => laneBits(shapes[index].scalar, value)))
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lanes(scalar, row, argument, size) {
  const values = Array.from({ length: size }, (_, lane) => valueAt(scalar, row, argument, lane));
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

/**
 * The int inputs: zero, small values of both signs, the edges of the int range and of 16 bits, and
 * shift amounts past 31. Godot draws an int lane as its two's complement bits.
 */
export const INT_VALUES = [
  0, 1, -1, 2, -3, 7, 31, 32, 255, -256, 65536, 1000003, -12345, 2147483647, -2147483648, 5,
];

/** The uint inputs: zero, small values, the edges of 16 and 32 bits, and shift amounts past 31. */
export const UINT_VALUES = [
  0, 1, 2, 3, 7, 31, 32, 33, 255, 65535, 65536, 1000003, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff,
];

/** The bool inputs, in an order whose lanes at the lane stride differ. */
export const BOOL_VALUES = [
  false,
  true,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  true,
  false,
  true,
];

/** The input table of each scalar kind, each as long as the float table. */
export const VALUES = { float: FLOAT_VALUES, int: INT_VALUES, uint: UINT_VALUES, bool: BOOL_VALUES };

/** The bits Godot and the GPU hold for `value` as a lane of `scalar` kind. */
export function laneBits(scalar, value) {
  switch (scalar) {
    case 'float':
      return floatBits(value);
    case 'int':
    case 'uint':
      return value >>> 0;
    case 'bool':
      return value ? 1 : 0;
    default:
      throw new Error(`expected a scalar kind of float, int, uint or bool, got ${scalar}`);
  }
}

/** The value whose lane bits `laneBits` gives as `bits`: its inverse, for inputs kept as bits. */
export function laneOfBits(scalar, bits) {
  switch (scalar) {
    case 'float':
      return new Float32Array(new Uint32Array([bits]).buffer)[0];
    case 'int':
      return bits | 0;
    case 'uint':
      return bits >>> 0;
    case 'bool':
      return bits !== 0;
    default:
      throw new Error(`expected a scalar kind of float, int, uint or bool, got ${scalar}`);
  }
}

/** The lanes of an argument, a float as one lane. */
export function lanesOf(argument) {
  return Array.isArray(argument) ? argument : [argument];
}
