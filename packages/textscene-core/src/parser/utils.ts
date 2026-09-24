export interface ParsedHeading {
  type: string;
  attributes: Record<string, string>;
}

/**
 * Whitespace, as `\s` matches it. Splitting on the non-ASCII tail is the lenient
 * reading: it keeps the attribute, and so the node, where gluing the space into the
 * next key would drop a node the tree needs.
 */
function isSpaceCode(code: number): boolean {
  if (code === 32 || (code >= 9 && code <= 13)) return true;
  // Godot rejects this tail: a heading key is `[A-Za-z_][A-Za-z0-9_]*`
  // (variant_parser.cpp:493), and an NBSP is neither whitespace (`cchar <= 32`) nor
  // an identifier character, so it raises "Unexpected character" (:508).
  if (code < 0xa0) return false;
  return (
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/** `[A-Za-z0-9_]`: the characters a constructor name is built from. */
function isIdentCode(code: number): boolean {
  return (
    (code >= 97 && code <= 122) ||
    (code >= 65 && code <= 90) ||
    (code >= 48 && code <= 57) ||
    code === 95
  );
}

/** First index at or after `pos` that is whitespace (or `str.length`). */
function skipToSpace(str: string, pos: number): number {
  let i = pos;
  while (i < str.length && !isSpaceCode(str.charCodeAt(i))) i++;
  return i;
}

/**
 * Index just past the quote closing the string opened at `pos`, or -1 if it never
 * closes. Godot's escape rule: `\` consumes the next character, and the next unescaped
 * `"` ends the string.
 */
// {@link scanValueChunk} and {@link stripLineComment} walk the same rule, since each
// asks a different question: one resumes mid-string, the other finds the first `;`
// outside a string. A change to the escape convention lands in all three.
function scanQuoted(str: string, pos: number): number {
  for (let i = pos + 1; i < str.length; i++) {
    if (str[i] === '\\') i++; // skip the escaped character
    else if (str[i] === '"') return i + 1;
  }
  return -1;
}

/**
 * Index just past the `close` matching the `open` at `start`, counting nesting and
 * skipping quoted strings, or -1 if it never closes. An unquoted `=` is the next
 * attribute, so it ends the search: a stray `(` cannot swallow the attributes behind
 * it, and the scan stays within one attribute.
 */
function scanBalanced(str: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (c === '"') {
      // An unterminated string swallows the rest, so nothing can still close.
      const end = scanQuoted(str, i);
      if (end === -1) return -1;
      i = end - 1;
    } else if (c === '=') return -1;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Whether the token at `i` can only be a value. Every attribute begins `identifier =`,
 * so a string, an array, a number and a constructor are unambiguous. A bare identifier
 * is not: Godot rejects it as a value, so reading it as the next attribute recovers a
 * heading with a missing value.
 */
function opensAValue(str: string, i: number): boolean {
  const char = str[i];
  if (char === '"' || char === '[' || char === '-') return true;
  const code = str.charCodeAt(i);
  if (code >= 48 && code <= 57) return true;
  let end = i;
  while (end < str.length && isIdentCode(str.charCodeAt(end))) end++;
  return end > i && str[end] === '(';
}

/**
 * One attribute value from `pos`, verbatim, plus the index just past it. A quoted
 * string, a `[...]` array and a `Name(...)` constructor are delimiter-balanced. Anything
 * else, and any value whose delimiter never closes, runs to the next whitespace.
 */
function scanHeadingValue(str: string, pos: number): { value: string; nextPos: number } {
  const len = str.length;

  // Godot skips whitespace before a value (`variant_parser.cpp:1861-1863`, `:415-417`),
  // so `name= "Root"` is `name="Root"`. A bare identifier stays behind, since it
  // cannot be told from the next attribute: that recovers `type= parent="Foo"`.
  let start = pos;
  while (start < len && isSpaceCode(str.charCodeAt(start))) start++;
  if (start !== pos && !opensAValue(str, start)) start = pos;

  const first = str[start];
  let end = -1;

  if (first === '"') {
    end = scanQuoted(str, start);
  } else if (first === '[') {
    end = scanBalanced(str, start, '[', ']');
  } else {
    // A constructor is an identifier immediately followed by `(`: a space
    // before the paren belongs to the next attribute, not to this value.
    let i = start;
    while (i < len && isIdentCode(str.charCodeAt(i))) i++;
    if (i > pos && str[i] === '(') {
      const close = scanBalanced(str, i, '(', ')');
      if (close !== -1 && (close === len || isSpaceCode(str.charCodeAt(close)))) end = close;
    }
  }

  if (end === -1) end = skipToSpace(str, start);
  return { value: str.slice(start, end), nextPos: end };
}

/**
 * Whether `value` is one `"…"` string with nothing after it. `scanQuoted`, not
 * `endsWith('"')`: in `"a\"` the trailing quote is escaped, so the string never closes.
 */
function isWholeString(value: string): boolean {
  return value[0] === '"' && scanQuoted(value, 0) === value.length;
}

/**
 * The text inside a value that is one whole string literal, escapes still as written:
 * `"…"`, or the StringName jacket `&"…"` and its 3.x spelling `@"…"`
 * (`variant_parser.cpp:263-265`). Null for any other value.
 */
function stringLiteralBody(value: string): string | null {
  const bare = value.startsWith('&') || value.startsWith('@') ? value.slice(1) : value;
  return isWholeString(bare) ? bare.slice(1, -1) : null;
}

/**
 * Strip a heading value's quotes and decode `\"`, both or neither: decoding an
 * unclosed value destroys the `\"` that keeps it re-parseable. Other escapes are a node
 * parser's business ({@link unquoteString}), and a structured value stays verbatim.
 */
function unquoteHeadingValue(value: string): string {
  // An opening quote and nothing else carries no content, and the empty string
  // is what says so: `name` has to stay falsy for the strict parser to go on
  // reporting it missing.
  if (value === '"') return '';
  // The value was captured with the same scanner, so the two agree on where the
  // string ends.
  if (!isWholeString(value)) return value;
  const inner = value.slice(1, -1);
  return inner.includes('\\') ? inner.replace(/\\"/g, '"') : inner;
}

export function parseHeading(line: string): ParsedHeading | null {
  const trimmed = line.trim();

  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }

  const content = trimmed.slice(1, -1).trim();

  // No whitespace means `spaceIndex === content.length`, so the type is the
  // whole content and the attribute scan runs over an empty string.
  const spaceIndex = skipToSpace(content, 0);
  const type = content.slice(0, spaceIndex);
  const attributesStr = content.slice(spaceIndex);

  const attributes: Record<string, string> = {};
  let pos = 0;
  const len = attributesStr.length;

  while (pos < len) {
    while (pos < len && isSpaceCode(attributesStr.charCodeAt(pos))) pos++;
    if (pos >= len) break;

    const keyStart = pos;
    while (pos < len && attributesStr[pos] !== '=' && !isSpaceCode(attributesStr.charCodeAt(pos))) pos++;

    // An empty key means `pos` sits on a stray `=`: step over that one
    // character, so a `=key="v"` typo costs the `=` and not the attribute
    // behind it.
    if (pos === keyStart) {
      pos++;
      continue;
    }

    const key = attributesStr.slice(keyStart, pos);

    // The `=` may sit any distance past the key: `get_token`
    // (`variant_parser.cpp:1855-1858`) skips `cchar <= 32` (`:415-417`), so Godot loads
    // `[node name = "Root"]`. `scanHeadingValue` crosses the same whitespace after it.
    let equals = pos;
    while (equals < len && isSpaceCode(attributesStr.charCodeAt(equals))) equals++;

    // Not `key=…`: drop this token alone and resync at the next whitespace,
    // rather than abandoning every attribute that follows it.
    if (attributesStr[equals] !== '=') {
      pos = skipToSpace(attributesStr, pos);
      continue;
    }
    pos = equals + 1; // skip '='

    // Godot writes one attribute with a space after its `=`: `" binds= " + vars`
    // (`scene/resources/resource_format_text.cpp`), an Array that opens with `[`.
    // Skip the space only before a `[`, or a key with no value swallows the
    // `key=value` pair after it.
    const afterEquals = pos;
    while (pos < len && isSpaceCode(attributesStr.charCodeAt(pos))) pos++;
    if (attributesStr[pos] !== '[') pos = afterEquals;

    // An empty capture means `pos` sits on whitespace or the end (`key=` with
    // nothing after it), so the skip at the top of the loop still advances.
    const { value: rawValue, nextPos } = scanHeadingValue(attributesStr, pos);
    pos = nextPos;
    if (!rawValue) continue;

    attributes[key] = unquoteHeadingValue(rawValue);
  }

  return { type, attributes };
}

export function parseProperty(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith(';')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  const value = trimmed.slice(equalsIndex + 1).trim();

  return { key, value };
}

export function isHeading(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

/**
 * The section keywords that open a real heading. Unlike {@link isHeading}, this skips
 * BBCode tags and bracketed content on their own line inside a multi-line value, so
 * only a new section salvages an unterminated value.
 */
const SECTION_HEADING_RE =
  /^\[(gd_scene|gd_resource|ext_resource|sub_resource|node|resource|connection|editable)\b/;

export function isSectionHeading(line: string): boolean {
  return SECTION_HEADING_RE.test(line.trim());
}

export function isEmpty(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * The string/bracket-balance scan state, carried across chunks so a growing
 * multi-line value visits each chunk once instead of rescanning from the start.
 */
export interface ValueScanState {
  inString: boolean;
  // Open `[`/`{`/`(` over closers. Godot's reader takes a newline as whitespace and
  // its writer ends every nested `Object(…)` with `)\n` (variant_parser.cpp:2234), so
  // a paren closes on a later line as readily as a bracket.
  depth: number;
}

/** The scan state before any characters have been seen. */
export const INITIAL_SCAN_STATE: ValueScanState = { inString: false, depth: 0 };

/**
 * Advance the balance scan over `chunk` alone, from the previous chunk's state: one
 * call per appended line keeps a multi-line value O(total length). A `\n` separator
 * changes neither field, so each raw line scans without its joining newline.
 */
export function scanValueChunk(chunk: string, state: ValueScanState): ValueScanState {
  let { inString, depth } = state;
  for (let i = 0; i < chunk.length; i++) {
    const c = chunk[i];
    if (inString) {
      if (c === '\\') i++; // skip the escaped character
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
  }
  return { inString, depth };
}

/**
 * The line without its `;` comment: VariantParser skips from an unquoted `;` to the
 * line end (variant_parser.cpp:214). `#` opens a colour literal (`:241`), not a comment.
 * `inString` is the state at the line start, so a `;` inside an open string stays.
 */
export function stripLineComment(line: string, inString = false): string {
  // Every parsed line reaches this and almost none holds a `;`: the native pre-scan
  // skips the loop below, which otherwise costs about 28% of total parse time.
  if (!line.includes(';')) return line;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === ';') return line.slice(0, i);
  }
  return line;
}

/** True when a scan state reflects an unterminated string or unbalanced brackets. */
export function isIncompleteState(state: ValueScanState): boolean {
  return state.inString || state.depth > 0;
}

/**
 * True while a value's string is open or its brackets or parens are unbalanced.
 * Godot spans lines with strings, arrays such as `SpriteFrames` `animations`, and
 * nested `Object(…)` calls. One {@link scanValueChunk} from {@link INITIAL_SCAN_STATE}: the
 * hot path in `TscnParserCore` carries the state itself to avoid an O(length^2) rescan.
 */
export function isIncompleteValue(value: string): boolean {
  return isIncompleteState(scanValueChunk(value, INITIAL_SCAN_STATE));
}

/** The escapes the tokenizer maps to a control character (`variant_parser.cpp:299-312`). */
const ESCAPE_MAP: Record<string, string> = {
  b: '\b',
  t: '\t',
  n: '\n',
  f: '\f',
  r: '\r',
};

/**
 * A string's text with its escapes decoded as the tokenizer does: `\b \t \n \f \r`,
 * `\uXXXX` and `\UXXXXXX`, and any other escaped character to itself
 * (`variant_parser.cpp:350-351`).
 */
function decodeEscapes(text: string): string {
  if (!text.includes('\\')) return text;
  // One left-to-right pass, so `\\u1234` is `\` plus literal `u1234`. A `\u` without
  // four hex digits stays as written: the tokenizer's `case 'u'` errors there rather
  // than passing the character through.
  return text.replace(
    /\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{6}|[^uU])/g,
    (_match, seq: string) => {
      if (seq[0] === 'u' || seq[0] === 'U') {
        const code = parseInt(seq.slice(1), 16);
        // `\UXXXXXX` accepts six hex digits, past the Unicode maximum, and a
        // literal beyond it would throw and abort the whole scene parse.
        return code <= 0x10ffff ? String.fromCodePoint(code) : `\\${seq}`;
      }
      return ESCAPE_MAP[seq] ?? seq;
    },
  );
}

/**
 * A value as a STRING slot reads it: the quotes and any `&"…"` jacket come off, and the
 * escapes decode. A value that is not one whole string literal is read as a string's
 * text already out of its quotes, so its escapes still decode: an array element or a
 * dictionary key arrives here without them.
 */
export function unquoteString(value: string): string {
  return decodeEscapes(stringLiteralBody(value) ?? value);
}

/**
 * The text of a value that is one whole string literal, read as {@link unquoteString}
 * reads it. Any other value (a number, a bool, a Dictionary, a constructor or an unclosed
 * string) comes back verbatim, since the escapes inside it belong to its own literals.
 */
export function unquoteLiteral(value: string): string {
  const body = stringLiteralBody(value);
  return body === null ? value : decodeEscapes(body);
}

/**
 * A StringName value: the saver writes a `&` sigil, `&"Panel"`, where a String has
 * none (`core/variant/variant_utility.cpp`). Strips the sigil, then unquotes. A bare
 * quoted string passes through, so a scene without the sigil still parses.
 */
export function unquoteStringName(value: string): string {
  return unquoteString(value.startsWith('&') ? value.slice(1) : value);
}

/**
 * Whether a `[node]` heading overrides a node inside instanced content: Godot writes
 * one with neither `type=` nor `instance=`. An `instance_placeholder=` heading declares
 * an InstancePlaceholder (packed_scene.cpp:255). Both node creators call this, so what
 * renders and what lints agree on an override.
 */
export function isPropertyOverrideHeading(heading: ParsedHeading): boolean {
  return (
    heading.type === 'node' &&
    !heading.attributes.type &&
    !heading.attributes.instance &&
    !heading.attributes.instance_placeholder
  );
}
