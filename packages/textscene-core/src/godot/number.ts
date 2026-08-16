/**
 * The number grammar Godot's own tokenizer reads (`variant_parser.cpp`).
 *
 * Two grammars, deliberately: the FINITE one the render decoders use, and the
 * widened one the linter uses. They are derived from each other so they cannot
 * drift; see {@link TSCN_FLOAT_PATTERN_SOURCE} for why they differ.
 */

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
 * pattern, derived from this one: {@link TSCN_FLOAT_PATTERN_SOURCE} below.
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
 * loads as `(20, 0)`. Read their captures through `storedInt` in `./int.js`.
 */
export function finiteTupleRegex(typeName: string, arity: number): RegExp {
  const component = `(${FLOAT_PATTERN_SOURCE})`;
  const body = Array.from({ length: arity }, () => component).join(String.raw`\s*,\s*`);
  return new RegExp(String.raw`^${typeName}\s*\(\s*${body}\s*\)$`);
}

/**
 * The float spellings Godot's parser accepts that `parseFloat` does not.
 *
 * `variant_parser.cpp:150-155` (the string form) and `:701-706` (the token
 * form) both recognise these, and the serializer writes them back, so a `.tscn`
 * carrying `zoom = inf` is a file Godot produced and reloads. `parseFloat`
 * returns NaN for every one of them, which made the shared numeric validator
 * report a FORMAT error on a legal value.
 *
 * Being non-finite is not by itself a defect. Only five setters in `scene/`
 * refuse it (`ERR_FAIL_COND(!is_finite(...))`), and those five say so with the
 * `finite` grounding rather than relying on a parse accident.
 */
const NON_FINITE_FLOATS: Readonly<Record<string, number>> = {
  inf: Infinity,
  '-inf': -Infinity,
  inf_neg: -Infinity,
  nan: NaN,
};

/**
 * One float COMPONENT of a composite literal, as Godot's tokenizer reads it:
 * the renderer's finite grammar plus the four spellings above.
 *
 * `_parse_construct` (`variant_parser.cpp:552-596`) accepts any constructor
 * argument that is a number OR an identifier `stor_fix` recognises, and the
 * writer puts every component of every real-typed composite through `rtos_fix`
 * (`Vector2` :2040, `Rect2` :2048, `Vector3` :2056, `Vector4` :2064, `Plane`
 * :2072, `AABB` :2076, `Quaternion` :2080, `Transform2D` :2090, `Basis` :2104,
 * `Transform3D` :2119, `Projection` :2135, `Color` :2145, and the packed float
 * / vector / colour arrays :2459-2549). So every one of those can carry `inf`.
 * The `i`-suffixed composites cannot: they serialise through `itos`.
 *
 * DELIBERATELY not the renderer's grammar. {@link FLOAT_PATTERN_SOURCE} stays
 * finite because a component that reaches three.js as `Infinity` yields NaN
 * geometry, and the lenient parser's warn-then-unset fallback (a documented
 * default) is the better render of a value no viewport can show. That split
 * already exists for SCALARS — `floatOr` in `parser/valueParsers.ts` falls back
 * on `inf` while `v.float` accepts it — and this is the same split for
 * composites. The linter's job is to report what Godot refuses, and Godot
 * refuses none of these.
 *
 * Derived from the finite grammar and from {@link NON_FINITE_FLOATS}'s keys, so
 * the pattern cannot come to accept a spelling `parseGodotFloat` does not read,
 * or vice versa. Longest key first, so `inf_neg` is never shadowed by `inf`
 * (the alternation is leftmost-first). The keys are literal-safe: letters,
 * an underscore and a leading `-`, none of them regex metacharacters outside a
 * character class.
 *
 * Adds no quantifier, so the ReDoS shape the finite grammar is careful about
 * (see its docblock) is untouched: the four alternatives are fixed-length
 * literals, and none of them can start where the numeric branch can, since that
 * branch needs a digit or `.` after its optional sign. At most one alternative
 * is viable at any position, so this stays a constant factor on a linear match
 * rather than a new backtracking dimension.
 *
 * No capture group — callers wrap it in `(…)` and read `match[1..arity]`.
 */
export const TSCN_FLOAT_PATTERN_SOURCE = `(?:${Object.keys(NON_FINITE_FLOATS)
  .sort((a, b) => b.length - a.length)
  .join('|')}|${FLOAT_PATTERN_SOURCE})`;

/**
 * ONE float literal, anchored — the same grammar as a tuple component, for the
 * arbitrary-length packed arrays, whose elements are checked one at a time
 * rather than through a fixed-arity regex. Compiled once and shared; no `g`
 * flag, so `.test()` on the shared instance is stateless.
 */
export const TSCN_FLOAT_RE = new RegExp(`^${TSCN_FLOAT_PATTERN_SOURCE}$`);

/**
 * A TSCN float literal as a number, or `null` when the text is not one.
 *
 * `null` rather than NaN is the miss signal precisely because `nan` is itself a
 * legal value: the two must stay distinguishable.
 */
export function parseGodotFloat(value: string): number | null {
  const trimmed = value.trim();
  if (Object.prototype.hasOwnProperty.call(NON_FINITE_FLOATS, trimmed)) {
    return NON_FINITE_FLOATS[trimmed]!;
  }
  // `parseFloat` also reads JavaScript's own spellings, which Godot's tokenizer
  // does not: it matches the four above and nothing else. Rejected by exact
  // name rather than by testing the result for non-finiteness, because
  // `1e999` overflows to infinity in Godot too and is a legal literal.
  if (trimmed === 'Infinity' || trimmed === '-Infinity' || trimmed === '+Infinity') {
    return null;
  }
  // The anchored grammar, for the same reason `parseGodotInt` applies it:
  // `parseFloat` stops at the first character it cannot use, so `75abc` read as
  // 75 and a bound then reported a number the file does not contain — or, where
  // the value was in range, said nothing at all about a line Godot's tokenizer
  // cannot read. Godot stops the number at `a` (variant_parser.cpp:450) and
  // glues the rest onto the NEXT assignment's name (:1948), so the line is not
  // merely unreadable, it corrupts its successor.
  if (!TSCN_FLOAT_RE.test(trimmed)) return null;
  const num = parseFloat(trimmed);
  return Number.isNaN(num) ? null : num;
}

/**
 * One component of a composite that the FINITE grammar already matched.
 *
 * The float twin of `storedInt`. A capture from `finiteTupleRegex` has been
 * vetted by the grammar, so the read itself is a bare `parseFloat` and cannot
 * fail — the value of naming it is that `parseFloat` on UNVETTED Variant text is
 * a defect (it stops at the first unusable character, so `75abc` reads as 75),
 * and the two are indistinguishable at a call site. With both spellings named,
 * `godotLiteralGrammar.guard.test.ts` can ban the raw call outright instead of
 * carrying a roster of the places it happens to be safe.
 *
 * Non-finite input is the caller's mistake, not this function's: use
 * {@link parseGodotFloat} for anything a finite grammar has not already matched.
 */
export function matchedFloat(capture: string): number {
  return parseFloat(capture);
}
