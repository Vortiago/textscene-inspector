export interface ParsedHeading {
  type: string;
  attributes: Record<string, string>;
}

/**
 * Whitespace, enumerated as `\s` matches it. Godot itself accepts none of the
 * non-ASCII tail: a heading key is an identifier, `[A-Za-z_][A-Za-z0-9_]*`
 * (variant_parser.cpp:493), and an NBSP is neither whitespace to skip
 * (`cchar <= 32`) nor an identifier character, so it raises "Unexpected
 * character" (:508) and the file does not load. Splitting is the lenient
 * reading: it keeps the attribute, and so the node, rather than gluing the
 * space into the next key and dropping a node the tree needs.
 */
function isSpaceCode(code: number): boolean {
  if (code === 32 || (code >= 9 && code <= 13)) return true;
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

/** `[A-Za-z0-9_]` — the characters a constructor name is built from. */
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
 * Index just past the quote closing the string whose OPENING quote is at `pos`;
 * -1 if it never closes. Godot's escape rule: `\` consumes the next character,
 * and the next unescaped `"` ends the string.
 *
 * Three scans in this file walk that rule, because each asks a different
 * question and none can answer another's: this one takes an opening quote and
 * returns where it closes, {@link scanValueChunk} resumes mid-string across
 * chunks and so has no opening quote to anchor on, and
 * {@link stripLineComment} needs the first `;` that is NOT inside a string.
 * A change to the escape convention has to land in all three.
 */
function scanQuoted(str: string, pos: number): number {
  for (let i = pos + 1; i < str.length; i++) {
    if (str[i] === '\\') i++; // skip the escaped character
    else if (str[i] === '"') return i + 1;
  }
  return -1;
}

/**
 * Index just past the `close` that matches the `open` at `start`, counting
 * nesting and ignoring delimiters inside quoted strings; -1 if it never closes.
 *
 * An unquoted `=` ends the search unmatched. It cannot be content: constructor
 * arguments are values, dictionaries key on `:`, and a quoted string is
 * skipped whole — so an `=` is the next attribute, reached because this value's
 * delimiter never closed. Stopping there is what keeps a stray `(` from
 * swallowing the attributes behind it, and bounds the scan to one attribute
 * instead of re-reading to end-of-line for every attribute on the line.
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
 * Scan one attribute value starting at `pos` in `str`, returning it verbatim
 * (quotes and escapes intact) plus the index just past it. A quoted string, a
 * `[...]` array and a `Name(...)` constructor are delimiter-balanced so a space
 * or a nested delimiter inside them doesn't end the value; anything else — and
 * any value whose delimiter never closes — runs to the next whitespace, which
 * is where the next attribute can start.
 */
/**
 * Can the token at `i` only be a VALUE, never the start of the next attribute?
 *
 * Every attribute begins `identifier =`, so a quoted string, a `[…]` array, a
 * number and a constructor (an identifier glued to its `(`) are unambiguous.
 * A BARE identifier is not: Godot rejects one as a value, so reading it as the
 * next attribute is the lenient recovery a heading with a missing value needs.
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

function scanHeadingValue(str: string, pos: number): { value: string; nextPos: number } {
  const len = str.length;

  // Godot skips whitespace before a value: `_parse_tag` calls `get_token`
  // straight after `TK_EQUAL` (`variant_parser.cpp:1861-1863`) and that token
  // loop breaks on `cchar <= 32` (`:415-417`), so `name= "Root"` really is
  // `name="Root"`. Cross the space for every form that can only be a value;
  // a bare identifier is the one that cannot be told from the next attribute,
  // and leaving it behind is what recovers `type= parent="Foo"`.
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
    // A constructor is an identifier IMMEDIATELY followed by `(` — a space
    // before the paren belongs to the next attribute, not to this value.
    let i = start;
    while (i < len && isIdentCode(str.charCodeAt(i))) i++;
    if (str[i] === '(') end = scanBalanced(str, i, '(', ')');
  }

  if (end === -1) end = skipToSpace(str, start);
  return { value: str.slice(start, end), nextPos: end };
}

/**
 * Drop a property value's surrounding quotes: a value quoted at BOTH ends, and
 * long enough for the two quotes to be distinct. Anything else passes through.
 */
/**
 * The body of a quoted literal, with the StringName jacket a STRING slot
 * converts from: `&"…"` and the 3.x-compatible `@"…"` are one `TK_STRING_NAME`
 * (`variant_parser.cpp:263-265`), and `variant.cpp:582-587` lists `STRING_NAME`
 * as a strict source for `STRING`. Anything else passes through unchanged.
 */
function stripQuotes(value: string): string {
  const bare = value.startsWith('&') || value.startsWith('@') ? value.slice(1) : value;
  return bare.length >= 2 && bare.startsWith('"') && bare.endsWith('"')
    ? bare.slice(1, -1)
    : value;
}

/**
 * Unwrap a quoted heading value: strip the surrounding quotes and decode `\"`.
 * Both steps together or neither — decoding a value whose quote never closed
 * would destroy the `\"` that keeps the raw text re-parseable. Heading
 * attributes are carried as source text, so a structured value stays verbatim
 * and the rest of Godot's escapes are a node parser's business
 * ({@link unquoteString}).
 */
function unquoteHeadingValue(value: string): string {
  // An opening quote and nothing else carries no content, and the empty string
  // is what says so: `name` has to stay falsy for the strict parser to go on
  // reporting it missing.
  if (value === '"') return '';
  // `scanQuoted`, not `endsWith('"')`: a trailing quote can be an ESCAPED one,
  // so `"a\"b\"` ends in a quote while its string never closes. Unwrapping it
  // decoded the `\"` that keeps the raw text re-parseable and handed back
  // `a"b\`. The scanner is the same rule the value was captured with, so the
  // two cannot disagree about where the string ends.
  if (value[0] !== '"' || scanQuoted(value, 0) !== value.length) return value;
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

    // An empty key means `pos` sits on a stray `=`: step over that ONE
    // character, so a `=key="v"` typo costs the `=` and not the attribute
    // behind it.
    if (pos === keyStart) {
      pos++;
      continue;
    }

    const key = attributesStr.slice(keyStart, pos);

    // The `=` may sit any distance past the key: `_parse_tag` reads it through
    // its own `get_token` (`variant_parser.cpp:1855-1858`), whose loop breaks on
    // `cchar <= 32` (`:415-417`), so `[node name = "Root"]` is a heading Godot
    // loads — the same whitespace rule `scanHeadingValue` already crosses on the
    // other side of the `=`. Stopping the key scan at the space and then
    // demanding `=` at that exact index dropped every attribute of such a line.
    let equals = pos;
    while (equals < len && isSpaceCode(attributesStr.charCodeAt(equals))) equals++;

    // Not `key=…`: drop this token alone and resync at the next whitespace,
    // rather than abandoning every attribute that follows it.
    if (attributesStr[equals] !== '=') {
      pos = skipToSpace(attributesStr, pos);
      continue;
    }
    pos = equals + 1; // skip '='

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
 * The TSCN section keywords that open a real `[…]` heading. A line is only a
 * genuine section heading if its first token is one of these — unlike
 * {@link isHeading}, which also matches BBCode tags (`[center]`, `[u]…[/u]`)
 * and bracketed array/dict content that legitimately appear ON THEIR OWN LINE
 * inside a multi-line value. Used to decide when an unterminated multi-line
 * value should be salvaged because a new section has actually begun.
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
 * Running state of the string/bracket-balance scan, carried forward across
 * chunks so a growing multi-line value can be scanned incrementally (each new
 * chunk visited exactly once) instead of rescanned from the start every time
 * a line is appended. `depth` counts `[`/`{`/`(` outstanding over `]`/`}`/`)`:
 * Godot's reader is token-based and takes a newline as whitespace, and its own
 * writer ends every nested `Object(…)` with `)\n` (variant_parser.cpp:2234),
 * so a paren closes on a later line as readily as a bracket does.
 */
export interface ValueScanState {
  inString: boolean;
  depth: number;
}

/** The scan state before any characters have been seen. */
export const INITIAL_SCAN_STATE: ValueScanState = { inString: false, depth: 0 };

/**
 * Advance a string/bracket-balance scan by one chunk, given the state left
 * off by the previous chunk. Scans ONLY `chunk` — O(chunk length), not the
 * length of whatever came before — so a caller accumulating a multi-line
 * value line-by-line can call this once per new line and stay O(total length)
 * overall instead of O(length^2). A `\n` line separator has no effect on
 * either `inString` or `depth`, so it is safe to scan each raw line on its own
 * without the joining newline present.
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
 * The line without its `;` comment: VariantParser skips from an unquoted `;`
 * to the end of the line (variant_parser.cpp:214), so what follows one is never
 * part of a value or a heading. `#` is left alone — it opens a colour literal
 * (`:241`), not a comment. `inString` is the scan state at the start of the
 * line, so a `;` on the continuation line of an open string stays.
 */
export function stripLineComment(line: string, inString = false): string {
  // Every line of every parsed file reaches this, and 98% of them hold no `;`
  // at all: without the native pre-scan the interpreted loop below costs ~28%
  // of total parse time for a result it always throws away.
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
 * True when a property value isn't complete on this line. Godot writes
 * multi-line values as unterminated strings (label text), as bracketed
 * arrays/dicts spanning lines — packed arrays and especially `SpriteFrames`
 * `animations = [{ … }]` — and as nested `Object(…)` calls, and reads a
 * hand-written `PackedVector2Array(` continued below. The line-based parsers
 * must keep accumulating until quotes, brackets and parens all balance, or the
 * value is truncated to its first fragment. Single string-aware scan:
 * incomplete if a string is still open, or openers outnumber closers outside
 * strings.
 *
 * A thin wrapper over {@link scanValueChunk} — full-string callers (tests,
 * and the single-line check on a property's first line) don't need to carry
 * scan state across calls, so this scans `value` from {@link INITIAL_SCAN_STATE}
 * in one shot. The multi-line accumulation hot path in `TscnParserCore`
 * carries the state forward itself instead of calling this repeatedly on a
 * growing string (that would reintroduce the O(length^2) rescan).
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
 * Strip a value's surrounding quotes (and the `&"…"` StringName jacket a STRING
 * slot converts from) and decode Godot's string escapes the way the tokenizer
 * does: `\b \t \n \f \r` to their control characters, `\uXXXX` / `\UXXXXXX`
 * to the code point, and every other escaped character to itself
 * (`variant_parser.cpp:350-351`, `default: res = next` — so `\"`, `\\` and
 * `\'` all yield the character). Non-quoted values pass through unchanged.
 * A single left-to-right pass so an escaped backslash (`\\u1234`) is decoded as
 * `\` + literal `u1234`, not as a Unicode escape. Used wherever a node parser
 * reads a string property (label/button text, …).
 *
 * A `\u` without its hex digits is left as written: the tokenizer's `case 'u'`
 * reads exactly four hex digits and errors otherwise, never falling through
 * to the pass-through arm.
 */
export function unquoteString(value: string): string {
  const unquoted = stripQuotes(value);
  if (!unquoted.includes('\\')) return unquoted;
  return unquoted.replace(
    /\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{6}|[^uU])/g,
    (_match, seq: string) => {
      if (seq[0] === 'u' || seq[0] === 'U') {
        const code = parseInt(seq.slice(1), 16);
        // `\UXXXXXX` accepts six hex digits, past the Unicode maximum — a
        // literal beyond it would throw and abort the whole scene parse.
        return code <= 0x10ffff ? String.fromCodePoint(code) : `\\${seq}`;
      }
      return ESCAPE_MAP[seq] ?? seq;
    },
  );
}

/**
 * Whether a `[node]` heading OVERRIDES the node already at its path rather than
 * declaring a new one.
 *
 * Godot writes an override with neither `type=` nor `instance=` — the node it
 * names already exists inside instanced content, so there is nothing to declare,
 * only properties to change. An `instance_placeholder=` heading declares a node
 * of its own, an InstancePlaceholder (packed_scene.cpp:255). `[node name="Robot" parent="Player/Skeleton/Skeleton3D"]`
 * retextures a mesh inside a GLB; `[node name="CoinCount" type="Label3D" parent="..."]`
 * beside it adds a genuinely new child.
 *
 * Lives here rather than in either node creator because BOTH of them build
 * nodes from a heading — the renderer's registry and the linter's strict parser
 * — and the two disagreeing about what an override is would be a silent
 * divergence between what renders and what lints.
 */
export function isPropertyOverrideHeading(heading: ParsedHeading): boolean {
  return (
    heading.type === 'node' &&
    !heading.attributes.type &&
    !heading.attributes.instance &&
    !heading.attributes.instance_placeholder
  );
}
