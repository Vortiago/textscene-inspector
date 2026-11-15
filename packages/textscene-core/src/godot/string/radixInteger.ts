import { INT64_MAX, INT64_MIN } from '../variant/cInteger.js';

// An invalid digit gives 0, and an overflow the int64 limit of its sign.
function radixToInt(
  text: string,
  radix: bigint,
  prefix: string,
  digitOf: (char: string) => bigint | undefined
): bigint {
  if (text.length === 0) return 0n;
  const sign = text[0] === '-' ? -1n : 1n;
  let index = sign < 0n ? 1 : 0;
  if (text.length > 2 && text[index] === '0' && text[index + 1]?.toLowerCase() === prefix) index += 2;
  const limit = (INT64_MAX >> BigInt(radix.toString(2).length - 1)) + 1n;
  let value = 0n;
  for (; index < text.length; index += 1) {
    const char = text[index]!.toLowerCase();
    const digit = digitOf(char);
    if (digit === undefined) return 0n;
    const overflow =
      (value > INT64_MAX / radix && (sign === 1n || value !== limit)) ||
      (sign === -1n && value === limit && char > '0');
    if (overflow) return sign === 1n ? INT64_MAX : INT64_MIN;
    value = value * radix + digit;
  }
  return BigInt.asIntN(64, value * sign);
}

const hexDigit = (char: string): bigint | undefined =>
  /^[0-9a-f]$/.test(char) ? BigInt(Number.parseInt(char, 16)) : undefined;
const binaryDigit = (char: string): bigint | undefined =>
  char === '0' || char === '1' ? BigInt(char) : undefined;

/**
 * `String::hex_to_int` (ustring.cpp:2187).
 *
 * @canonical Godot's reading of a hexadecimal integer text
 */
export const hexToInt64 = (text: string): bigint => radixToInt(text, 16n, 'x', hexDigit);

/**
 * `String::bin_to_int` (ustring.cpp:2228).
 *
 * @canonical Godot's reading of a binary integer text
 */
export const binToInt64 = (text: string): bigint => radixToInt(text, 2n, 'b', binaryDigit);
