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

/** `String::c_unescape` (ustring.cpp:4461): the reverse pairs, with the backslash last. */
export function cUnescape(text: string): string {
  const pairs = [...ESCAPES.slice(1), ESCAPES[0]!];
  return pairs.reduce((unescaped, [character, escape]) => unescaped.replaceAll(escape, character), text);
}

// In the order json_escape replaces them: c_escape's, less the bell and the single quote.
const JSON_ESCAPES = ESCAPES.filter(([character]) => character !== '\x07' && character !== "'");

/** `String::json_escape` (ustring.cpp:4501). */
export function jsonEscape(text: string): string {
  return JSON_ESCAPES.reduce((escaped, [from, to]) => escaped.replaceAll(from, to), text);
}

/** `String::xml_escape` (ustring.cpp:4515): `&`, `<` and `>`, and with `escapeQuotes` both quotes. */
export function xmlEscape(text: string, escapeQuotes: boolean): string {
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return escapeQuotes ? escaped.replaceAll("'", '&apos;').replaceAll('"', '&quot;') : escaped;
}
