const POWERS_OF_TEN = [1e1, 1e2, 1e4, 1e8, 1e16, 1e32, 1e64, 1e128, 1e256]; // ustring.cpp:2385-2399
const CHUNK_DIGITS = 9;
const CHUNK_BASE = 1e9;

function decimalScale(exponent: number): number {
  let scale = 1;
  let bits = Math.min(Math.abs(exponent), (1 << POWERS_OF_TEN.length) - 1);
  for (const power of POWERS_OF_TEN) {
    if (bits & 1) scale *= power;
    bits >>= 1;
  }
  return scale;
}

/** @canonical convert a validated Godot decimal FLOAT token with the engine's mantissa and exponent rounding */
export function decimalFloat(text: string): number {
  const unsigned = text.startsWith('-') ? text.slice(1) : text;
  const [mantissa, exponent] = unsigned.toLowerCase().split('e');
  const point = mantissa!.indexOf('.');
  const integerDigits = point < 0 ? mantissa!.length : point;
  // ustring.cpp:2474-2507
  const digits = mantissa!.replace('.', '').slice(0, 2 * CHUNK_DIGITS);
  const split = Math.max(0, digits.length - CHUNK_DIGITS);
  const fraction = CHUNK_BASE * Number(digits.slice(0, split)) + Number(digits.slice(split));
  let power = 0;
  for (const digit of (exponent ?? '').replace(/^[-+]/, '')) power = (10 * power + Number(digit)) | 0;
  const decimalExponent = (integerDigits - digits.length + (exponent?.startsWith('-') ? -power : power)) | 0;
  // With an empty exponent, Godot returns the unscaled fraction (ustring.cpp:2526-2528).
  const hasEmptyExponent = exponent === '' || exponent === '+' || exponent === '-';
  const scale = hasEmptyExponent ? 1 : decimalScale(decimalExponent);
  const value = decimalExponent < 0 ? fraction / scale : fraction * scale;
  return text.startsWith('-') ? -value : value;
}
