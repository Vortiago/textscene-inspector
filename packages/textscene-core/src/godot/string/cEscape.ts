// In the order c_escape replaces them.
const ESCAPES: readonly (readonly [string, string])[] = [
  ['\\', '\\\\'],
  ['\x07', '\\a'],
  ['\b', '\\b'],
  ['\f', '\\f'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
  ['\v', '\\v'],
  ["'", "\\'"],
  ['"', '\\"'],
];

/** `String::c_escape` (ustring.cpp:4477). */
export function cEscape(text: string): string {
  return ESCAPES.reduce((escaped, [from, to]) => escaped.replaceAll(from, to), text);
}

/** `String::c_escape_multiline` (ustring.cpp:4493): only the backslash and the double quote. */
export function cEscapeMultiline(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
