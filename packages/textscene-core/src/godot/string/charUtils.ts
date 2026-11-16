/**
 * `is_whitespace` (char_utils.h:121) of the code point that starts `char`.
 *
 * @canonical Godot's whitespace class of a character
 */
export function isWhitespace(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    code === 0x20 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200b) ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x09 && code <= 0x0d) ||
    code === 0x85
  );
}

/**
 * `String::is_valid_ascii_identifier` (ustring.cpp:4343): ASCII letters, digits and `_`, no leading digit.
 *
 * @canonical An ASCII identifier test
 */
export const isValidAsciiIdentifier = (text: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(text);

/**
 * `is_digit` (char_utils.h:89) of a code point. Undefined, a read past the end of a text, is no digit.
 *
 * @canonical Godot's decimal digit test of a code point
 */
export const isDigitCode = (code: number | undefined): boolean =>
  code !== undefined && code >= 0x30 && code <= 0x39;

/**
 * The value of a code point `is_hex_digit` (char_utils.h:93) accepts, in either case, or undefined.
 *
 * @canonical The value of a hexadecimal digit
 */
export function hexDigitCodeValue(code: number): number | undefined {
  if (isDigitCode(code)) return code - 0x30;
  if (code >= 0x61 && code <= 0x66) return code - 0x61 + 10;
  if (code >= 0x41 && code <= 0x46) return code - 0x41 + 10;
  return undefined;
}

/** `hexDigitCodeValue` of a one-character text, or undefined for any other text. */
export const hexDigitValue = (char: string): number | undefined =>
  [...char].length === 1 ? hexDigitCodeValue(char.codePointAt(0)!) : undefined;
