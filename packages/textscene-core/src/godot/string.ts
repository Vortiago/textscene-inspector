/** `String`'s parsing behaviour, as the engine defines it. */

/**
 * The spelling `String::is_valid_int()` accepts: an optional single sign, then
 * digits, and nothing else.
 *
 * The sign class is `[+-]?`, not `-?`. A leading `+` is a real spelling Godot
 * reads, and admitting it in one regex while a sibling rejects it has already
 * cost a false positive here: a `settings/+0/…` key entered no index map and its
 * sibling reported a write the engine applies.
 *
 * NOT the same as `to_int()`, which is the other of Godot's two integer parses:
 * {@link stringToInt} SKIPS non-digits rather than stopping at them
 * (`ustring.cpp:2267-2301`), so `"x"` reads as 0 and `"a1b2"` as 12, and text
 * this regex rejects still resolves to a number under it. Which parse a class
 * uses decides whether a non-numeric index is a dropped write or a landed one,
 * so never substitute one for the other — see `indexedFamilyValidator`'s
 * `indexParse` option.
 *
 * No `g` flag, so `.test()` on the shared instance is stateless.
 *
 * The source is separate because an indexed property key embeds this spelling
 * mid-pattern (`godot/indexedKey.ts`), and a second copy of it there is the
 * drift this whole grammar exists to prevent.
 */
export const IS_VALID_INT_SOURCE = String.raw`[+-]?\d+`;
export const IS_VALID_INT_RE = new RegExp(`^${IS_VALID_INT_SOURCE}$`);

/**
 * The text inside a serialised `String`, `StringName` or `NodePath` literal.
 *
 * Godot 4's writer prefixes a bare StringName with `&` and a bare NodePath with
 * `^` (`variant_parser.cpp`'s `write` for `Variant::STRING_NAME` /
 * `Variant::NODE_PATH`), so `autoplay = &"spin"` and `animation = "walk"` are
 * the same string wearing different jackets. A rule comparing an authored name
 * against an engine constant has to compare the CONTENTS, and doing that by
 * hand is how one slice came to treat `&""` as a non-empty name.
 *
 * Only the outer jacket comes off, and only a MATCHED pair of it: `" default "`
 * keeps its spaces, because `set_animation` compares the contents and
 * `" default " == "default"` is false. A value that was never quoted comes back
 * trimmed and otherwise untouched.
 */
export function literalText(raw: string): string {
  const bare = raw.trim().replace(/^[&^]/, '');
  const quoted = /^(["'])([\s\S]*)\1$/.exec(bare);
  return quoted ? quoted[2]! : bare;
}

/**
 * Depth/quote-aware split of a bracket body's top-level comma-separated
 * elements, so a comma inside a nested literal or a quoted resource id is never
 * mistaken for a separator. Empty input yields no elements.
 *
 * `(`/`[` both open a level and `)`/`]` both close one, because Godot's own
 * writer nests the two interchangeably — `Array[NodePath]([NodePath("a"),
 * NodePath("b")])` puts a paren body inside a bracket body. Inside a quoted
 * run, a backslash escapes the next character, so an embedded `\"` does not
 * end the quote.
 */
export function splitTopLevel(body: string): string[] {
  const trimmed = body.trim();
  if (trimmed === '') return [];
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (inQuote) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '"') inQuote = false;
      continue;
    }
    if (c === '"') {
      inQuote = true;
    } else if (c === '(' || c === '[') {
      depth++;
    } else if (c === ')' || c === ']') {
      depth--;
    } else if (c === ',' && depth === 0) {
      parts.push(trimmed.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(trimmed.slice(start));
  return parts.map((p) => p.trim());
}

/**
 * `splitTopLevel` splits by comma alone, so a TRAILING comma before the closing
 * bracket reads as one more (empty) element than Godot's own array actually
 * holds. `_parse_array` (variant_parser.cpp:1643-1677) checks for
 * `TK_BRACKET_CLOSE` before it ever demands another value (:1658-1662, before
 * the `need_comma` branch at :1663), so `[1, 2,]` loads as a 2-element array,
 * not 3. Only ONE trailing empty is ever a trailing comma: an interior `,,`
 * fails `parse_value` on the comma token itself (:1664-1665's `need_comma`
 * branch demands a value, not another comma), so that shape is already an
 * invalid `.tscn` no matter how this drops it.
 *
 * Every bracket-array validator needs this. Three shipped without it and
 * rejected a comma Godot accepts.
 */
export function dropTrailingComma(parts: string[]): string[] {
  return parts.length > 1 && parts[parts.length - 1] === '' ? parts.slice(0, -1) : parts;
}

/**
 * The largest magnitude a JS number spells exactly.
 *
 * The reader's bound, tighter than the engine's own: `_to_int` saturates at
 * INT64_MAX / INT64_MIN (`ustring.cpp:2283-2284`), and every value that reaches
 * either is long past the point where the double stops being the integer the
 * text states. So the saturation is subsumed rather than reproduced — anything
 * that would hit it is refused here first.
 */
const TO_INT_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const ZERO = '0'.charCodeAt(0);
const MINUS = '-'.charCodeAt(0);
const NINE = '9'.charCodeAt(0);

/**
 * `String::to_int()` (`ustring.cpp:2303-2311`) — Godot's OTHER integer parse,
 * and not a parse in the usual sense at all.
 *
 * Three behaviours separate it from every other reader here, and each one turns
 * text that looks unreadable into a number the engine acts on:
 *
 * - A character it cannot use is SKIPPED, not a failure and not a stop: the
 *   digit branch and the sign branch are the only two, and anything else falls
 *   past both (`:2280-2293`). `"x"` is 0 and `"a1b2"` is 12.
 * - A `-` seen while the accumulated total is still 0 FLIPS the sign
 *   (`:2291-2292`). That is a flip, not a leading-sign rule: `"a-1"` is -1,
 *   `"--1"` is 1, and `"1-2"` is 12 because the total is no longer 0 by then.
 * - The scan stops at the first `.` (`:2308`), so `"12.9"` is 12 without a
 *   float ever being read.
 *
 * Which of the two parses a class uses decides whether a malformed index is a
 * dropped write or a landed one, so never substitute {@link IS_VALID_INT_RE}
 * for this or the reverse.
 *
 * `NaN` for a value outside {@link TO_INT_SAFE}: the engine holds an int64
 * there and this reader cannot name it, and NaN keeps every comparison false
 * rather than letting a wrong number travel.
 */
export function stringToInt(text: string): number {
  // `if (length() == 0) return 0` (`:2304-2306`).
  if (text.length === 0) return 0;
  const dot = text.indexOf('.');
  const to = dot >= 0 ? dot : text.length;
  let integer = 0n;
  let positive = true;
  for (let i = 0; i < to; i++) {
    const code = text.charCodeAt(i);
    if (code >= ZERO && code <= NINE) {
      integer = integer * 10n + BigInt(code - ZERO);
      // Returning here rather than at the end also keeps a pathological run of
      // digits from growing a BigInt nobody will read.
      if (integer > TO_INT_SAFE) return NaN;
    } else if (integer === 0n && code === MINUS) {
      positive = !positive;
    }
  }
  // Negated as a BigInt, not as a double: `-Number(0n)` is `-0`, and the engine
  // holds one zero.
  return Number(positive ? integer : -integer);
}

/**
 * The index a hand-rolled `_set` resolves from the text between a property
 * path's prefix and the next `/`.
 *
 * Godot's indexed families that build their own property list read the index
 * with a bare `path.get_slicec('/', n).to_int()` and no validity gate —
 * `chain_ik_3d.cpp:37`, `bone_twist_disperser_3d.cpp:37`,
 * `spring_bone_simulator_3d.cpp:42` — so {@link stringToInt} is the reader, and
 * `settings/a-1/…` names index -1 rather than no index at all.
 *
 * A clean {@link IS_VALID_INT_RE} spelling goes through `Number` instead, and
 * that is NOT an exactness claim: past 2^53 neither reader is the int64 the
 * text states (`Number('9007199254740993')` is off by one). It buys the SIGN,
 * which is the only thing the `ERR_FAIL_INDEX_V` guard beside each of those
 * parses asks, and which `stringToInt` surrenders to NaN at its own bound.
 *
 * Text that is neither — a non-integer spelling whose digits also overrun
 * {@link stringToInt} — reads NaN, so every comparison against it stays false
 * and no wrong index travels.
 *
 * A class that gates on `String::is_valid_int()` before using the index
 * (`PropertyListHelper::_get_property`, `property_list_helper.cpp:53-55`) has
 * no index at all for text this returns a number for, so it must test the
 * regex itself rather than call this.
 */
export function toIntIndex(text: string): number {
  return IS_VALID_INT_RE.test(text) ? Number(text) : stringToInt(text);
}

/**
 * `String::to_float()` (`core/string/ustring.cpp:2680-2685`) — an empty string
 * is 0, and everything else goes through `built_in_strtod`, which consumes the
 * longest numeric prefix and yields 0 when there is none.
 *
 * NOT {@link parseGodotFloat}. That reads a TSCN float LITERAL, which is
 * anchored and refuses trailing text, because a value the tokenizer cannot read
 * corrupts the assignment after it. `to_float` is the lenient runtime scan a
 * class applies to text it already holds — a BBCode tag option, a split
 * component — where trailing text is simply ignored and there is no next
 * assignment to corrupt. Substituting either for the other changes what a
 * malformed value reads as.
 */
export function stringToFloat(text: string): number {
  // `built_in_strtod` skips leading whitespace, then takes the longest prefix
  // it can read; `parseFloat` has the same prefix rule and the same 0-length
  // miss, differing only in accepting JavaScript's `Infinity` spelling, which
  // the digit guard below refuses.
  const trimmed = text.trimStart();
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}
