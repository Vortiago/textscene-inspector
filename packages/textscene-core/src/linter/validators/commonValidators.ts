/** Shared validator utilities for common property types */

import type { ParseError } from '../../linter/types.js';
import type { PropertyValidator } from '../propertyValidator.js';
import { propertyError } from './propertyError.js';
import { FLOAT_PATTERN_SOURCE } from '../../parser/vectors.js';

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
 * DELIBERATELY not the renderer's grammar. `parser/vectors.ts` keeps
 * {@link FLOAT_PATTERN_SOURCE} finite because a component that reaches three.js
 * as `Infinity` yields NaN geometry, and the lenient parser's warn-then-unset
 * fallback (a documented default) is the better render of a value no viewport
 * can show. That split already exists for SCALARS — `floatOr` in
 * `parser/valueParsers.ts` falls back on `inf` while `v.float` accepts it — and
 * this is the same split for composites. The linter's job is to report what
 * Godot refuses, and Godot refuses none of these.
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
 * A TSCN literal as the integer Godot would STORE in a `Variant::INT` slot, or
 * `null` when the text is not a literal Godot's tokenizer can read.
 *
 * Not `parseInt`. Two distinct accidents come from `parseInt` stopping at the
 * first character it cannot use, and both cleared bounds silently:
 *
 * - `2e4` read as 2. The tokenizer sets `is_float` on the `e`
 *   (variant_parser.cpp:446-448), and the FLOAT is converted on assignment, so
 *   Godot stores 20000 and any ceiling below it should have reported.
 * - `8abc` read as 8. Godot's parser cannot read that at all, so it is a format
 *   error rather than a value in range.
 *
 * A float literal in an INT slot is legal and truncates TOWARD ZERO, which is
 * what the C++ conversion does, so `5.9` is 5 and `-5.9` is -5.
 *
 * A non-finite literal READS — `inf` and `nan` are identifiers the tokenizer
 * resolves for a bare slot too (variant_parser.cpp:701-707), so the file loads
 * — but it does not FIT, so the result is NaN rather than the spelling as
 * written. See {@link asStoredInt} for the measurement and for why the stored
 * number is not reproduced here.
 */
export function parseGodotInt(value: string): number | null {
  const trimmed = value.trim();
  if (!TSCN_FLOAT_RE.test(trimmed)) return null;
  const asFloat = parseGodotFloat(trimmed);
  if (asFloat === null) return null;
  return asStoredInt(asFloat);
}

/**
 * A number as the int32 an INT slot STORES: truncated toward zero, which is
 * what the C++ conversion does.
 *
 * A NON-FINITE number is not representable at all, and reads as NaN rather than
 * passing through. Measured on 4.6.3 stable (x86_64), `Vector2i(inf, 8)`,
 * `(-inf, 8)`, `(inf_neg, 8)` and `(nan, 8)` all store `(-2147483648, 8)` — the
 * narrowing happens at PARSE time, so the stored value is not what the file
 * says. That number is deliberately NOT returned here: the conversion is
 * undefined behaviour in C++ and the practical result is architecture-specific
 * (x86 `cvttsd2si` yields INT32_MIN, AArch64 `fcvtzs` saturates the other way),
 * and Godot ships on both. NaN keeps every bound comparison false, so no
 * message can print a number no platform agrees on; the ALTERATION itself is
 * reported by the non-finite arm in `v.vector2i`, which is the portable claim.
 */
function asStoredInt(num: number): number {
  return Number.isFinite(num) ? Math.trunc(num) : NaN;
}

/**
 * One capture group of an ALREADY-MATCHED float tuple, as a number.
 *
 * The component grammar and {@link parseGodotFloat} are derived from the same
 * table, so a component the regex matched always reads: the NaN is unreachable,
 * and every comparison against it is false anyway, which is what a validator
 * wants for a component it cannot place on the number line. Use this rather
 * than `parseFloat` wherever a matched component is compared, or `inf` reads as
 * NaN and a bound silently stops applying to it.
 */
export function tupleComponent(text: string | undefined): number {
  return parseGodotFloat(text ?? '') ?? NaN;
}

/**
 * The same, for a component of an `i`-suffixed composite: the int32 Godot
 * stores rather than the number as written.
 *
 * Exported because the tuple regexes are exported, and a caller that `.exec()`s
 * one and then reaches for `parseInt` gets 2 out of `2e1` and NaN out of `inf`
 * — the accident {@link parseGodotInt} exists to stop, reintroduced one capture
 * at a time.
 */
export function intComponent(text: string | undefined): number {
  return asStoredInt(tupleComponent(text));
}

/** True when an already-matched component cannot be stored in an int32 slot. */
export function isUnrepresentableInt(text: string | undefined): boolean {
  return !Number.isFinite(tupleComponent(text));
}

/**
 * Creates a boolean validator function
 * Validates that a value is either 'true' or 'false'
 */
export function createBooleanValidator(
  propertyName: string,
  errorCode: string = 'INVALID_BOOLEAN_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return propertyError(key, line, `Property '${propertyName}' must be a boolean (true or false), got: "${value}"`, errorCode);
    }
    return null;
  };
}

/**
 * Creates an enum validator for integer enum values
 */
export function createEnumValidator(
  propertyName: string,
  min: number,
  max: number,
  enumValues: Record<number, string>,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE',
  /**
   * Severity of the RANGE branch (ADR-0032). The FORMAT branch below stays an
   * error unconditionally: an unparseable value is malformed whatever the
   * engine does with it.
   */
  valueSeverity: ParseError['severity'] = 'error',
  /**
   * Severity of the MAX branch, defaulting to the min's. Separate for the same
   * reason `createNumericRangeValidator` splits them: an enum can have an
   * enforced floor and a merely hinted ceiling, and collapsing the two to a
   * single severity reported an ERROR for a value only the inspector hint
   * excludes.
   */
  maxSeverity: ParseError['severity'] = valueSeverity
): PropertyValidator {
  const validator: PropertyValidator = (key, value, line) => {
    const num = parseGodotInt(value);
    if (num === null) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }
    if (num < min || num > max) {
      const validValuesStr = Object.entries(enumValues)
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      return propertyError(
        key,
        line,
        `Property '${propertyName}' must be ${min}-${max} (got ${num}). Valid values: ${validValuesStr}`,
        errorCodeValue,
        num < min ? valueSeverity : maxSeverity
      );
    }
    return null;
  };
  return validator;
}

/**
 * The setter's OWN limit at one end, where it sits outside the hint's.
 *
 * The two are separate tiers and both are reachable, so one slot cannot hold
 * them: `AudioStreamPlayer.pitch_scale` is refused at `<= 0` and hinted from
 * 0.01, and collapsing that to a single floor either errors on 0.005 (a value
 * Godot loads) or says nothing about it (a value the inspector excludes).
 */
export interface EnforcedEnd {
  /** The limit itself. */
  at: number;
  /** `ERR_FAIL_COND(x <= at)` rather than `< at`: the endpoint is refused too. */
  exclusive?: boolean;
}

/** What a numeric range validator checks, and how it reports each end. */
export interface NumericRangeSpec {
  propertyName: string;
  /** Outer floor. Its severity is `minSeverity`, so a hinted one warns. */
  min?: number | null;
  /** Outer ceiling. */
  max?: number | null;
  /**
   * The setter's floor, below `min`. Anything under it is an ERROR whatever
   * `minSeverity` says, and the band up to `min` still reports at that tier.
   */
  enforcedMin?: EnforcedEnd;
  /** The setter's ceiling, above `max`. */
  enforcedMax?: EnforcedEnd;
  parseAsInt?: boolean;
  /** Replaces the derived text on the OUTER ends only. */
  message?: string;
  /** Replaces the derived text on the setter's own ends, which state a different reason. */
  enforcedMessage?: string;
  errorCodeFormat?: string;
  errorCodeValue?: string;
  /**
   * Severity of the outer MIN branch; the FORMAT branch stays an error.
   * Separate from the max because a property can have an enforced floor and a
   * merely hinted ceiling (ADR-0032).
   */
  minSeverity?: ParseError['severity'];
  /** Severity of the outer MAX branch. Defaults to the min's. */
  maxSeverity?: ParseError['severity'];
}

/** `must be greater than 3` / `must be at least 3`, per exclusivity. */
function refusalMessage(
  propertyName: string,
  end: EnforcedEnd,
  side: 'min' | 'max',
  num: number
): string {
  const relation =
    side === 'min'
      ? end.exclusive
        ? 'greater than'
        : 'at least'
      : end.exclusive
        ? 'less than'
        : 'at most';
  return `Property '${propertyName}' must be ${relation} ${end.at} (got ${num}); Godot's setter refuses the write.`;
}

/** Creates a numeric range validator for float/int values. */
export function createNumericRangeValidator(spec: NumericRangeSpec): PropertyValidator {
  const {
    propertyName,
    min = null,
    max = null,
    enforcedMin,
    enforcedMax,
    parseAsInt = false,
    message: customMessage,
    enforcedMessage,
    errorCodeFormat = 'INVALID_FORMAT',
    errorCodeValue = 'INVALID_VALUE',
    minSeverity: valueSeverity = 'error',
    maxSeverity = valueSeverity,
  } = spec;
  const validator: PropertyValidator = (key, value, line) => {
    // `inf`/`nan` are legal literals in either slot, so the miss signal is null
    // and a parsed NaN falls through to the range checks, which it never trips.
    const num = parseAsInt ? parseGodotInt(value) : parseGodotFloat(value);
    // An INT slot narrows a non-finite at PARSE time to a value the file does
    // not state (see `asStoredInt`), so the literal is ALTERED and reports as
    // an error. A FLOAT slot stores it verbatim and says nothing. That is the
    // whole difference between the two, and it is the engine's own.
    if (parseAsInt && num !== null && Number.isNaN(num)) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' cannot be stored in an integer slot, got: "${value}". The file loads, but the value is narrowed at parse time to a number the file does not state.`,
        errorCodeValue,
        'error'
      );
    }
    if (num === null) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' must be a number, got: "${value}"`,
        errorCodeFormat
      );
    }

    // The setter's own ends first: they are the more severe tier, and the band
    // between them and the hint's ends is what the outer checks below report.
    if (enforcedMin && (enforcedMin.exclusive ? num <= enforcedMin.at : num < enforcedMin.at)) {
      return propertyError(
        key,
        line,
        enforcedMessage ?? refusalMessage(propertyName, enforcedMin, 'min', num),
        errorCodeValue
      );
    }
    if (enforcedMax && (enforcedMax.exclusive ? num >= enforcedMax.at : num > enforcedMax.at)) {
      return propertyError(
        key,
        line,
        enforcedMessage ?? refusalMessage(propertyName, enforcedMax, 'max', num),
        errorCodeValue
      );
    }

    // Check min constraint
    if (min !== null && num < min) {
      // Pick a default message based on whether one bound or two are set.
      // Two bounds → "must be between X and Y" (matches the wording the
      // per-node linter tests assert). One bound → "must be >= X" or
      // "must be non-negative" (the legacy single-bound wording).
      let defaultMsg: string;
      if (max !== null) {
        defaultMsg = `Property '${propertyName}' must be between ${min} and ${max} (got ${num})`;
      } else if (min === 0) {
        defaultMsg = `Property '${propertyName}' must be non-negative (got ${num})`;
      } else {
        defaultMsg = `Property '${propertyName}' must be >= ${min}, got: ${num}`;
      }
      return propertyError(key, line, customMessage || defaultMsg, errorCodeValue, valueSeverity);
    }

    // Check max constraint
    if (max !== null && num > max) {
      const defaultMsg =
        min !== null
          ? `Property '${propertyName}' must be between ${min} and ${max} (got ${num})`
          : `Property '${propertyName}' must be <= ${max}, got: ${num}`;
      return propertyError(key, line, customMessage || defaultMsg, errorCodeValue, maxSeverity);
    }

    return null;
  };
  return validator;
}

/**
 * Creates a validator for positive integers (> 0)
 * Useful for properties that would cause division by zero if set to 0
 */
export function createPositiveIntegerValidator(
  propertyName: string,
  errorMessage?: string,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE',
  /** Severity of the RANGE branch; the FORMAT branch stays an error. */
  valueSeverity: ParseError['severity'] = 'error'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseGodotInt(value);
    if (num === null) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }
    if (num <= 0) {
      const defaultMsg = `Property '${propertyName}' must be greater than 0 (got ${num}). Zero or negative values cause division by zero.`;
      return propertyError(key, line, errorMessage || defaultMsg, errorCodeValue, valueSeverity);
    }
    return null;
  };
}
