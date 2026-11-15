/** The character tests and string operations of Godot's `String` that the preprocessor reads. */

/** `is_whitespace` (`char_utils.h:121`). */
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

/** `ShaderPreprocessor::is_char_word`. */
export const isCharWord = (char: string | undefined): boolean =>
  char !== undefined && /^[0-9A-Za-z_]$/.test(char);

/** `ShaderPreprocessor::is_char_space`. */
export const isCharSpace = (char: string): boolean => char === ' ' || char === '\t';

/** Godot's `0`: the terminator a `String` ends with, which the preprocessor reads as a character. */
export const END = '\0';

/** `ShaderPreprocessor::is_char_end`. */
export const isCharEnd = (char: string): boolean => char === '\n' || char === END;

/** `String::strip_edges`: every character at or under 32 goes from both ends. */
export function stripEdges(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text.charCodeAt(start) <= 32) start += 1;
  while (end > start && text.charCodeAt(end - 1) <= 32) end -= 1;
  return text.slice(start, end);
}

/** `String::is_valid_ascii_identifier`. */
export const isValidAsciiIdentifier = (text: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(text);
