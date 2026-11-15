/** char_utils.h:121 */
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

export const isCharWord = (char: string | undefined): boolean =>
  char !== undefined && /^[0-9A-Za-z_]$/.test(char);

export const isCharSpace = (char: string): boolean => char === ' ' || char === '\t';

// Godot's String ends in a 0, which the preprocessor reads as a character.
export const END = '\0';

export const isCharEnd = (char: string): boolean => char === '\n' || char === END;

// Godot strips every character at or under 32, wider than `trim`.
export function stripEdges(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text.charCodeAt(start) <= 32) start += 1;
  while (end > start && text.charCodeAt(end - 1) <= 32) end -= 1;
  return text.slice(start, end);
}

export const isValidAsciiIdentifier = (text: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(text);
