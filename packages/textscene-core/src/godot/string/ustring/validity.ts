import { hexDigitCodeValue, isDigitCode } from '../charUtils.js';

const PLUS = 0x2b;
const MINUS = 0x2d;

const isHexDigit = (code: number) => hexDigitCodeValue(code) !== undefined;
const isSign = (code: number | undefined) => code === PLUS || code === MINUS;

/** Where the digits start: past a sign, unless the sign is the whole text. */
const digitsStart = (codes: readonly number[]) => (codes.length !== 1 && isSign(codes[0]) ? 1 : 0);

/** `String::is_valid_int` (ustring.cpp:4744). */
export function isValidInt(codes: readonly number[]): boolean {
  return codes.length > 0 && codes.slice(digitsStart(codes)).every(isDigitCode);
}

/** `String::is_valid_hex_number` (ustring.cpp:4765): `0x`, lower case only, when `withPrefix`. */
export function isValidHexNumber(codes: readonly number[], withPrefix: boolean): boolean {
  if (codes.length === 0) return false;
  let from = digitsStart(codes);
  if (withPrefix) {
    if (codes.length < 3 || codes[from] !== 0x30 || codes[from + 1] !== 0x78) return false;
    from += 2;
  }
  return from !== codes.length && codes.slice(from).every(isHexDigit);
}

/** `String::is_valid_float` (ustring.cpp:4802): digits, one dot before an exponent, and a signed exponent. */
export function isValidFloat(codes: readonly number[]): boolean {
  if (codes.length === 0) return false;
  let hasExponent = false;
  let hasPeriod = false;
  let hasSign = false;
  let hasExponentDigits = false;
  let hasDigits = false;
  for (const code of codes.slice(isSign(codes[0]) ? 1 : 0)) {
    if (isDigitCode(code)) {
      if (hasExponent) hasExponentDigits = true;
      else hasDigits = true;
    } else if (hasDigits && !hasExponent && (code === 0x65 || code === 0x45)) hasExponent = true;
    else if (!hasPeriod && !hasExponent && code === 0x2e) hasPeriod = true;
    else if (isSign(code) && hasExponent && !hasExponentDigits && !hasSign) hasSign = true;
    else return false;
  }
  return hasDigits;
}
