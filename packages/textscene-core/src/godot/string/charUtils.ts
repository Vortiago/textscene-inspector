/** Godot's character classes of `char_utils.h` and the identifier test of `String`. */

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
