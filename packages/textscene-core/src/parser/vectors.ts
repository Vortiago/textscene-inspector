export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * One float component, in the language Godot's own tokenizer reads. Strict by
 * construction: `1.2.3` or a lone `-` fail the whole anchored match, so callers
 * throw (and the value-decoder wrappers warn-then-fall-back) instead of
 * silently mis-parsing.
 *
 * Transcribed from `get_token` (`variant_parser.cpp:420-481`), one clause at a
 * time, rather than from what a float "looks like":
 *
 * - `-?` — a leading `-` is consumed at :420. `+` is not, and the character
 *   after it must be a digit (:424), so `+` falls through to `Unexpected
 *   character` (:506). Measured on 4.6.3: `fov = +3`, `Vector2(+1, 2)` and
 *   `PackedVector2Array(1, 2, +0.5, 3)` all fail the load.
 * - `\d+` — REQUIRED. `.` is neither a digit nor an identifier start, so a
 *   leading-dot literal never reaches the number branch at all. Measured:
 *   `Vector2(.5, 2)` fails the load; `Vector2(5., 2)` loads as 5.
 * - `(?:\.\d*)?` — `READING_INT` takes one `.` into `READING_DEC` (:442), which
 *   accepts any number of digits including none.
 * - `(?:[eE][-+]?\d*)?` — `READING_EXP` (:466-472) takes one sign and any
 *   number of digits, again including none: the token simply ends and is read
 *   with `as_double`. Measured: `1e`, `1e-` and `5.e2` all load, as 1, 1 and
 *   500 — which is what `parseFloat` returns for each.
 *
 * The mantissa is `\d+(?:\.\d*)?`, NOT `\d+\.?\d*`: the latter lets a digit run
 * split between `\d+` and `\d*` in O(n) ways, so a non-matching tail (e.g. a
 * long digit run in untrusted .tscn input) backtracks quadratically — a ReDoS.
 * `\d+(?:\.\d*)?` matches the SAME language but consumes each digit run in one
 * `\d+`, keeping the match linear.
 *
 * FINITE by choice, and therefore NARROWER than Godot's own tokenizer: `inf`,
 * `-inf`, `inf_neg` and `nan` are legal components that Godot writes, and this
 * pattern refuses them so the decoders warn-then-fall-back to a documented
 * default rather than handing three.js an `Infinity` it renders as NaN
 * geometry. The linter must NOT report those, so it has its own widened
 * pattern, derived from this one: `TSCN_FLOAT_PATTERN_SOURCE` in
 * `linter/validators/commonValidators.ts`.
 */
export const FLOAT_PATTERN_SOURCE = String.raw`-?\d+(?:\.\d*)?(?:[eE][-+]?\d*)?`;

/**
 * The anchored regex for a fixed-arity composite written with the FINITE
 * grammar above, each component its own capture group.
 *
 * The renderer's counterpart to the linter's `makeFloatTupleRegex`, and the
 * only place a decoder may get one: a hand-rolled `(-?[\d.eE+-]+)` reads as
 * equivalent and is not — it accepts `e+-.` and rejects nothing useful — while
 * a hand-rolled `(-?\d+)` for an `i`-suffixed composite refuses values Godot
 * loads. `godotLiteralGrammar.guard.test.ts` keeps composite grammars to this
 * function and its linter sibling.
 *
 * The `i`-suffixed composites (`Vector2i`, `Rect2i`) use this same grammar,
 * deliberately: `_parse_construct<int32_t>` (`variant_parser.cpp:577-592`)
 * takes any number token and converts it, so `Vector2i(2e1, 0)` is a file Godot
 * loads as `(20, 0)`. Read their captures through {@link storedInt}.
 */
export function finiteTupleRegex(typeName: string, arity: number): RegExp {
  const component = `(${FLOAT_PATTERN_SOURCE})`;
  const body = Array.from({ length: arity }, () => component).join(String.raw`\s*,\s*`);
  return new RegExp(String.raw`^${typeName}\s*\(\s*${body}\s*\)$`);
}

/**
 * One matched component of an `i`-suffixed composite, as the int32 Godot
 * stores — or `null` when it cannot be stored as one.
 *
 * `null` for a non-finite component, so the decoder takes its documented
 * warn-then-fall-back path rather than handing `Infinity` to a render path.
 * Godot narrows it at parse time to an architecture-specific sentinel
 * (-2147483648 measured on 4.6.3 x86_64), which is a value no previewer can
 * usefully draw and which the finite grammar exists to keep out. The linter
 * reports the same literal from its own side; see `asStoredInt` there.
 */
export function storedInt(text: string | undefined): number | null {
  const num = parseFloat(text ?? '');
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

const VECTOR2_RE = finiteTupleRegex('Vector2', 2);
const VECTOR3_RE = finiteTupleRegex('Vector3', 3);

/**
 * `Color(r, g, b, a)` — the SAME float grammar as the vectors above. Compiled ONCE and shared by
 * the material/Environment Color decoder and linter validators so render and lint agree on
 * the channel grammar and never rebuild this regex per parse/lint call. No `g` flag, so `.test()`
 * and `.match()` on the shared instance are stateless.
 */
export const COLOR_RE = finiteTupleRegex('Color', 4);

export function parseVector2(value: string): Vector2 {
  const match = value.match(VECTOR2_RE);

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid Vector2 format: ${value}`);
  }

  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
  };
}

export function parseVector3(value: string): Vector3 {
  const match = value.match(VECTOR3_RE);

  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid Vector3 format: ${value}`);
  }

  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
    z: parseFloat(match[3]),
  };
}
