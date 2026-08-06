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
 * One float component as Godot serializes it, including scientific
 * notation (`1e-05`), which Godot emits for small values. Strict by
 * construction: `1.2.3` or a lone `-` fail the whole anchored match,
 * so callers throw (and the value-decoder wrappers warn-then-fall-back)
 * instead of silently mis-parsing.
 *
 * The integer branch is `\d+(?:\.\d*)?`, NOT `\d+\.?\d*`: the latter lets a
 * digit run split between `\d+` and `\d*` in O(n) ways, so a non-matching tail
 * (e.g. a long digit run in untrusted .tscn input) backtracks quadratically —
 * a ReDoS. `\d+(?:\.\d*)?` matches the SAME language but consumes each digit
 * run in one `\d+`, keeping the match linear.
 *
 * FINITE by choice, and therefore NARROWER than Godot's own tokenizer: `inf`,
 * `-inf`, `inf_neg` and `nan` are legal components that Godot writes, and this
 * pattern refuses them so the decoders warn-then-fall-back to a documented
 * default rather than handing three.js an `Infinity` it renders as NaN
 * geometry. The linter must NOT report those, so it has its own widened
 * pattern, derived from this one: `TSCN_FLOAT_PATTERN_SOURCE` in
 * `linter/validators/commonValidators.ts`.
 */
export const FLOAT_PATTERN_SOURCE = String.raw`[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?`;

const F = FLOAT_PATTERN_SOURCE;
const VECTOR2_RE = new RegExp(String.raw`^Vector2\s*\(\s*(${F})\s*,\s*(${F})\s*\)$`);
const VECTOR3_RE = new RegExp(String.raw`^Vector3\s*\(\s*(${F})\s*,\s*(${F})\s*,\s*(${F})\s*\)$`);

/**
 * `Color(r, g, b, a)` — the SAME float grammar as the vectors above. Compiled ONCE and shared by
 * the material/Environment Color decoder and linter validators so render and lint agree on
 * the channel grammar and never rebuild this regex per parse/lint call. No `g` flag, so `.test()`
 * and `.match()` on the shared instance are stateless.
 */
export const COLOR_RE = new RegExp(
  String.raw`^Color\s*\(\s*(${F})\s*,\s*(${F})\s*,\s*(${F})\s*,\s*(${F})\s*\)$`,
);

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
