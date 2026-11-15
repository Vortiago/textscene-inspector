/** `powersOf10` of `built_in_strtod` (`core/string/ustring.cpp:2388`): 10^(2^i). */
const POWERS_OF_10 = [10, 100, 1e4, 1e8, 1e16, 1e32, 1e64, 1e128, 1e256];

/** The largest decimal exponent the reader applies (`ustring.cpp:2387`). */
const MAX_EXPONENT = 511;

/** The mantissa digits the reader keeps (`ustring.cpp:2470`). */
const MAX_MANTISSA_DIGITS = 18;

const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9';

/**
 * The double `built_in_strtod` (`core/string/ustring.cpp:2365`) reads from `text`, step for step:
 * it is not correctly rounded, and the shader draws with what it gives.
 */
export function godotStrtod(text: string): number {
  let position = 0;
  while (text[position] === ' ' || text[position] === '\t' || text[position] === '\n') position += 1;
  let sign = false;
  if (text[position] === '-') {
    sign = true;
    position += 1;
  } else if (text[position] === '+') position += 1;

  const mantissaStart = position;
  let decimalPoint = -1;
  let mantissaSize = 0;
  for (; ; mantissaSize += 1, position += 1) {
    const char = text[position];
    if (!isDigit(char)) {
      if (char !== '.' || decimalPoint >= 0) break;
      decimalPoint = mantissaSize;
    }
  }
  const exponentStart = position;
  if (decimalPoint < 0) decimalPoint = mantissaSize;
  else mantissaSize -= 1;
  let fractionExponent: number;
  if (mantissaSize > MAX_MANTISSA_DIGITS) {
    fractionExponent = decimalPoint - MAX_MANTISSA_DIGITS;
    mantissaSize = MAX_MANTISSA_DIGITS;
  } else {
    fractionExponent = decimalPoint - mantissaSize;
  }
  if (mantissaSize === 0) return sign ? -0 : 0;

  const digits = text.slice(mantissaStart, exponentStart).replace('.', '').slice(0, mantissaSize);
  const high = Number(digits.slice(0, Math.max(0, mantissaSize - 9)) || '0');
  const low = Number(digits.slice(Math.max(0, mantissaSize - 9)) || '0');
  let fraction = 1.0e9 * high + low;

  let exponent = readExponent(text, exponentStart);
  exponent = fractionExponent + exponent;
  const negativeExponent = exponent < 0;
  exponent = Math.min(Math.abs(exponent), MAX_EXPONENT);
  let scale = 1.0;
  for (let index = 0; exponent !== 0; exponent >>= 1, index += 1) {
    if (exponent & 1) scale *= POWERS_OF_10[index]!;
  }
  fraction = negativeExponent ? fraction / scale : fraction * scale;
  return sign ? -fraction : fraction;
}

/** The signed exponent after `E` or `e` at `position`, or 0 when no digit follows (`ustring.cpp:2513`). */
function readExponent(text: string, position: number): number {
  if (text[position] !== 'e' && text[position] !== 'E') return 0;
  let cursor = position + 1;
  let negative = false;
  if (text[cursor] === '-') {
    negative = true;
    cursor += 1;
  } else if (text[cursor] === '+') cursor += 1;
  if (!isDigit(text[cursor])) return 0;
  let exponent = 0;
  while (isDigit(text[cursor])) {
    exponent = exponent * 10 + Number(text[cursor]);
    cursor += 1;
  }
  return negative ? -exponent : exponent;
}
