/** `String`'s parsing behaviour, as the engine defines it. */

/**
 * The spelling `String::is_valid_int()` accepts: an optional sign, then digits. `[+-]?`, not `-?`: Godot reads a leading `+`.
 * Not `to_int()`, which skips non-digits (`ustring.cpp:2267-2301`, {@link stringToInt}): the parse a class uses decides
 * whether a non-numeric index is dropped or lands, so never swap them (see `indexedFamilyValidator`'s `indexParse` option).
 * The source is separate so `godot/indexedKey.ts` embeds it rather than copy it. No `g` flag: `.test()` stays stateless.
 */
export const IS_VALID_INT_SOURCE = String.raw`[+-]?\d+`;
export const IS_VALID_INT_RE = new RegExp(`^${IS_VALID_INT_SOURCE}$`);

/**
 * One `"…"` string literal as the tokenizer scans it: `\` takes the next character, whatever it is,
 * and the next unescaped `"` ends the string (`variant_parser.cpp:276-290`). A source with no
 * capture group, so a caller embeds it in its own pattern.
 */
export const STRING_LITERAL_SOURCE = String.raw`"(?:[^"\\]|\\[\s\S])*"`;

/**
 * The text inside a serialised `String`, `StringName` or `NodePath` literal. Godot 4 writes a bare StringName with `&` and
 * a bare NodePath with `^` (`variant_parser.cpp`'s `write`), so `&"spin"` and `"walk"` are both plain names to compare.
 * Only a matched outer pair comes off: `" default "` keeps its spaces, because `set_animation` compares the contents.
 * A value that was never quoted comes back trimmed and otherwise untouched.
 */
export function literalText(raw: string): string {
  const bare = raw.trim().replace(/^[&^]/, '');
  const quoted = /^(["'])([\s\S]*)\1$/.exec(bare);
  return quoted ? quoted[2]! : bare;
}

/**
 * Depth- and quote-aware split of a bracket body's top-level comma-separated elements. Empty input yields no elements.
 * `(`/`[` both open a level and `)`/`]` both close one, because Godot's writer nests the two interchangeably
 * (`Array[NodePath]([NodePath("a"), NodePath("b")])`). Inside a quoted run a backslash escapes the next character.
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
 * Drops the empty element a trailing comma leaves. `_parse_array` returns on `]` before it asks
 * for a comma or a value (variant_parser.cpp:1658-1662), so `[1, 2,]` holds 2 elements. Only one
 * trailing empty counts: an interior `,,` fails `parse_value` (:1673-1676). Every bracket-array
 * validator needs this, or it rejects a comma Godot accepts.
 */
export function dropTrailingComma(parts: string[]): string[] {
  return parts.length > 1 && parts[parts.length - 1] === '' ? parts.slice(0, -1) : parts;
}

const ZERO = '0'.charCodeAt(0);
const SEVEN = '7'.charCodeAt(0);
const EIGHT = '8'.charCodeAt(0);
const NINE = '9'.charCodeAt(0);
const MINUS = '-'.charCodeAt(0);

const INT64_MAX = (1n << 63n) - 1n;
const INT64_MIN = -(1n << 63n);
/** `INT64_MAX / 10`, the bound `_to_int`'s overflow test compares against (`ustring.cpp:2283`). */
const INT64_MAX_TENTH = INT64_MAX / 10n;
/** `_to_int` tests for overflow only past 18 digits (`if (unlikely(digits > 18))`, `:2282`). */
const UNCHECKED_DIGITS = 18;
/** The digit count is a `uint8_t digits` (`:2275`), so `++digits` wraps to 0 after 255. */
const DIGIT_COUNT_MASK = 0xff;

/**
 * `String::to_int()` (`ustring.cpp:2303-2311`) as the int64 it returns. It skips a character it
 * cannot use (`:2280-2293`), so `"x"` is 0 and `"a1b2"` is 12, and it stops at the first `.`.
 */
function stringToInt64(text: string): bigint {
  // `if (length() == 0) return 0` (`:2304-2306`).
  if (text.length === 0) return 0n;
  const dot = text.indexOf('.');
  const to = dot >= 0 ? dot : text.length;
  let integer = 0n;
  let digits = 0;
  let positive = true;
  for (let i = 0; i < to; i++) {
    const code = text.charCodeAt(i);
    if (code >= ZERO && code <= NINE) {
      if (digits > UNCHECKED_DIGITS) {
        const overflow =
          integer > INT64_MAX_TENTH ||
          (integer === INT64_MAX_TENTH && (positive ? code > SEVEN : code > EIGHT));
        if (overflow) return positive ? INT64_MAX : INT64_MIN;
      }
      // `uint64_t integer` (`:2274`): while the wrapped count is 18 or less nothing is tested, and
      // the product wraps modulo 2^64 as the engine's does.
      integer = BigInt.asUintN(64, integer * 10n + BigInt(code - ZERO));
      digits = (digits + 1) & DIGIT_COUNT_MASK;
    } else if (integer === 0n && code === MINUS) {
      // A flip, not a leading-sign rule (`:2291-2292`): `"a-1"` is -1, `"--1"` is 1 and `"1-2"` is 12.
      positive = !positive;
    }
  }
  // `int64_t(integer)` and `int64_t(integer * uint64_t(-1))` (`:2296-2300`) wrap modulo 2^64, so a
  // 19-digit value past INT64_MAX, which the overflow test never sees, comes back negative.
  return BigInt.asIntN(64, positive ? integer : -integer);
}

/** A clean spelling of at most 15 digits: `to_int` reads its value, which a double holds. */
const EXACT_DOUBLE_INT_RE = /^[+-]?\d{1,15}$/;

/**
 * `String::to_int()` as the `int` or `uint32_t` a caller stores it in. Each indexed `_set` does
 * `int which = ….to_int()` (`property_list_helper.cpp:57`, `bone_twist_disperser_3d.cpp:37`), and
 * `skeleton_3d.cpp:82` a `uint32_t`. The narrowing keeps the low 32 bits, so `4294967296` is 0 and
 * `2147483648` is -2147483648. Always a safe integer, never NaN.
 */
export function stringToInt(text: string, width: 'int32' | 'uint32' = 'int32'): number {
  if (EXACT_DOUBLE_INT_RE.test(text)) {
    // ToInt32 and ToUint32 are exact below 2^53, and `| 0` maps `-0` to the engine's one zero.
    const value = Number(text);
    return width === 'int32' ? value | 0 : value >>> 0;
  }
  // int64 to `int` is implementation-defined before C++20: GCC, at `-std=gnu++17`
  // (SConstruct:891), keeps it modulo 2^32. To `uint32_t` it is modular by the standard.
  const value = stringToInt64(text);
  return Number(width === 'int32' ? BigInt.asIntN(32, value) : BigInt.asUintN(32, value));
}

/** The largest magnitude a JS number spells exactly, where {@link stringToIntOrNaN} stops. */
const TO_INT_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * `String::to_int()` read as a double: `NaN` outside {@link TO_INT_SAFE}, where the engine holds an
 * int64 this reader cannot name. Only {@link toIntIndex} reads it.
 */
function stringToIntOrNaN(text: string): number {
  // `if (length() == 0) return 0` (`:2304-2306`).
  if (text.length === 0) return 0;
  // The scan stops at the first `.` (`:2308`): `"12.9"` is 12 with no float read.
  const dot = text.indexOf('.');
  const to = dot >= 0 ? dot : text.length;
  let integer = 0n;
  let positive = true;
  for (let i = 0; i < to; i++) {
    const code = text.charCodeAt(i);
    if (code >= ZERO && code <= NINE) {
      integer = integer * 10n + BigInt(code - ZERO);
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
 * The index a hand-rolled `_set` reads with a bare `get_slicec('/', n).to_int()`
 * (`bone_twist_disperser_3d.cpp:37`): a clean spelling through `Number`, which keeps its sign past
 * 2^53, and any other through {@link stringToIntOrNaN}.
 */
export function toIntIndex(text: string): number {
  return IS_VALID_INT_RE.test(text) ? Number(text) : stringToIntOrNaN(text);
}

/**
 * `String::simplify_path()` (`core/string/ustring.cpp:4152-4210`) for the `scheme://` form of every `.tscn` resource address.
 * Godot splits the drive (ASCII alphanumerics then `://`) off the front and rebuilds the rest from its non-empty parts, so a
 * run of slashes collapses to one and `res:///addons/...` resolves. It leaves `.`/`..` alone: removing `..` without the
 * drive's own root would change which file a path names.
 */
export function simplifyResPath(path: string): string {
  const separator = path.indexOf('://');
  // `p > 0` plus the all-alphanumeric check (`:4159-4167`): `://x` has no
  // drive at all, and neither does a scheme carrying punctuation.
  if (separator <= 0 || !/^[A-Za-z0-9]+$/.test(path.slice(0, separator))) return path;
  const drive = path.slice(0, separator + 3);
  const rest = path.slice(separator + 3);
  return drive + rest.split('/').filter((part) => part !== '').join('/');
}

/**
 * `String::to_float()` (`core/string/ustring.cpp:2680-2685`): an empty string is 0, and `built_in_strtod` takes the longest
 * numeric prefix, or 0. Not {@link parseGodotFloat}, which reads an anchored TSCN float literal because unread text corrupts
 * the next assignment. `to_float` is the lenient scan a class applies to text it holds (a BBCode tag option, a split
 * component), so trailing text is ignored. Swapping the two changes what a malformed value reads as.
 */
export function stringToFloat(text: string): number {
  // `built_in_strtod` skips leading whitespace, then takes the longest prefix it can read. `parseFloat` has the same
  // prefix rule and 0-length miss, and differs only in reading JavaScript's `Infinity`, which the finite check maps to 0.
  const trimmed = text.trimStart();
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}
