const bits = new DataView(new ArrayBuffer(4));

/**
 * `Math::half_to_float` (math_funcs.h:744): the float of IEEE half bits, NaN significand kept.
 *
 * @canonical The float of a half precision value
 */
export function halfToFloat(half: number): number {
  bits.setUint32(0, halfBitsToFloatBits(half));
  return bits.getFloat32(0);
}

/** `halfbits_to_floatbits` (math_funcs.h:703). */
function halfBitsToFloatBits(half: number): number {
  const sign = (half & 0x8000) << 16;
  const exponent = half & 0x7c00;
  if (exponent === 0x7c00) return (sign + 0x7f800000 + ((half & 0x03ff) << 13)) >>> 0;
  if (exponent !== 0) return (sign + (((half & 0x7fff) + 0x1c000) << 13)) >>> 0;
  let significand = half & 0x03ff;
  if (significand === 0) return sign >>> 0;
  let shift = 0;
  significand <<= 1;
  while ((significand & 0x0400) === 0) {
    significand <<= 1;
    shift++;
  }
  return (sign + ((127 - 15 - shift) << 23) + ((significand & 0x03ff) << 13)) >>> 0;
}

/**
 * `Math::make_half_float` (math_funcs.h:748): truncated bits, and zero below the smallest normal half.
 *
 * @canonical The half precision bits of a float
 */
export function makeHalfFloat(value: number): number {
  bits.setFloat32(0, value);
  const x = bits.getUint32(0);
  const sign = x >>> 31;
  const mantissa = x & 0x7fffff;
  const exponent = (x & 0x7f800000) >>> 0;
  if (exponent >= 0x47800000) {
    const isNan = mantissa !== 0 && exponent === 0x7f800000;
    return (sign << 15) | (0x1f << 10) | ((isNan ? 0x7fffff : 0) >>> 13);
  }
  if (exponent <= 0x38000000) return 0;
  return (sign << 15) | ((exponent - 0x38000000) >>> 13) | (mantissa >>> 13);
}
