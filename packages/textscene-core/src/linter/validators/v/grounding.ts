/**
 * Where a validator's authority comes from, and the tags that record it.
 * `accepts` and `shape` declare what a validator takes; `ground` and
 * `endSeverity` turn a `Grounding` into its ADR-0032 tier. Every combinator
 * goes through one, so `boundGrounding.test.ts` can sweep the live registry.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import type { Severity } from '../../types.js';
import { propertyError } from '../propertyError.js';
import { parseGodotFloat, type EnforcedEnd } from '../commonValidators.js';
import { valueCode } from './codes.js';

/**
 * Where a bound's authority comes from (ADR-0032), with its governing
 * `file:line`. Every validator carrying a numeric or enum bound declares one.
 * A bound with neither errors, and `boundGrounding.test.ts` fails on it.
 */
export interface Grounding {
  /**
   * The setter guard that refuses or alters the value (`ERR_FAIL*`, a clamp, a
   * dropped write), so out of range errors. A bare string grounds both ends;
   * `{ min, max }` grounds them separately, as `PhysicalBone2D.bone2d_index`
   * needs for its guarded floor and hinted ceiling.
   */
  enforced?: string | { min?: string; max?: string };
  /**
   * The ADD_PROPERTY whose PROPERTY_HINT_RANGE states the bound while the setter
   * assigns straight through. The hint constrains the inspector, so out of range warns.
   */
  hinted?: string | { min?: string; max?: string };
}

/**
 * A `Grounding` that may also name a setter guard on `inf` and `nan`, legal
 * literals Godot writes and reloads (`variant_parser.cpp:150-155`). Only the
 * float combinators take it, so an int combinator given one fails to compile.
 * The two guards are different rules: never give a property the wider one.
 */
export interface FiniteGrounding extends Grounding {
  /** `file:line` of an `ERR_FAIL_COND(!is_finite(...))` in the setter. */
  finite?: string;
  /**
   * `file:line` of a `Math::is_nan` guard in a setter that stores `inf` and
   * `-inf` unaltered, such as `AudioStreamPlayer::set_volume_db`'s
   * `ERR_FAIL_COND_MSG(Math::is_nan(p_volume), …)`. `finite` wins where both
   * are given.
   */
  nan?: string;
}

/** The citation covering one end of a bound, if the grounding names it. */
function citeFor(g: string | { min?: string; max?: string } | undefined, end: 'min' | 'max') {
  if (g === undefined) return undefined;
  return typeof g === 'string' ? g : g[end];
}

/** Both ends' citations, in min-then-max order, without the duplicate a shared one makes. */
function distinctCites(g: string | { min?: string; max?: string } | undefined): string[] {
  const cites = [citeFor(g, 'min'), citeFor(g, 'max')].filter(
    (cite): cite is string => cite !== undefined
  );
  return [...new Set(cites)];
}

/**
 * Tag a validator with what it accepts, for the generated `## Linting` table.
 * A bespoke validator needs it too: `validatorAccepts.test.ts` fails on an
 * untagged one.
 */
export function accepts(validator: PropertyValidator, description: string): PropertyValidator {
  validator.accepts = description;
  return validator;
}

/**
 * `accepts`, plus the declaration that this validator rejects nothing but
 * malformed input. Every combinator, bespoke ones included, is a `shape` or
 * carries a `Grounding`, and `boundGrounding.test.ts` fails on one that is neither.
 */
export function shape(validator: PropertyValidator, description: string): PropertyValidator {
  validator.formatOnly = true;
  return accepts(validator, description);
}

/**
 * Reject the special float literals a setter refuses, ahead of the range check,
 * which reports `Infinity > max` for the wrong reason and says nothing on NaN.
 * One implementation for both guards: the tag forwarding below breaks silently,
 * and two copies of it would drift.
 */
function withLiteralGuard(
  validator: PropertyValidator,
  name: string,
  cite: string,
  refuses: (parsed: number) => boolean,
  requirement: string
): PropertyValidator {
  const guarded: PropertyValidator = (key, value, line) => {
    const parsed = parseGodotFloat(value);
    if (parsed !== null && refuses(parsed)) {
      return propertyError(
        key,
        line,
        `Property '${name}' ${requirement}; Godot's setter refuses "${value.trim()}"`,
        valueCode(name)
      );
    }
    return validator(key, value, line);
  };
  guarded.accepts = validator.accepts;
  // The bounded ends, their tiers and the numbers stay the inner validator's:
  // `hintImplementationParity` compares `bounds` against the engine's hint.
  guarded.tiers = validator.tiers;
  guarded.bounds = validator.bounds;
  // The tags a registry sweep navigates by: `everyValidator` descends `leaves`,
  // and the int-slot probe selects on `intSlot`. Dropping either shrinks the
  // sweep's population in silence.
  guarded.intSlot = validator.intSlot;
  guarded.leaves = validator.leaves;
  // Not `formatOnly`: `inf`/`nan` are legal literals, so this guard rejects a
  // real value. Keep both citations, as `ground` does: the literal guard and the
  // range guard are separate lines in the setter.
  const inner = validator.grounding?.cite;
  guarded.grounding = {
    // The inner kind wins where there is one. The literal branch is always an
    // error and says so directly, so stamping `enforced` unconditionally would
    // only mislabel a `hinted:` bound whose range branch still warns.
    kind: validator.grounding?.kind ?? 'enforced',
    cite: inner && inner !== cite ? `${cite}, ${inner}` : cite,
  };
  return guarded;
}

/** Reject all four non-finite spellings: `ERR_FAIL_COND(!is_finite(...))`. */
export function withFiniteGuard(
  validator: PropertyValidator,
  name: string,
  cite: string
): PropertyValidator {
  return withLiteralGuard(validator, name, cite, (n) => !Number.isFinite(n), 'must be finite');
}

/**
 * Reject `nan` alone, for a setter guarded by `Math::is_nan` rather than by
 * `!is_finite`. `inf` and `-inf` reach the field unaltered there, so the finite
 * guard cannot stand in: it would reject two values Godot stores.
 */
export function withNanGuard(
  validator: PropertyValidator,
  name: string,
  cite: string
): PropertyValidator {
  return withLiteralGuard(validator, name, cite, Number.isNaN, 'must not be NaN');
}

/** Apply `withFiniteGuard` only when the caller named a guard. */
export function maybeFinite(
  name: string,
  opts: FiniteGrounding,
  validator: PropertyValidator
): PropertyValidator {
  return opts.finite ? withFiniteGuard(validator, name, opts.finite) : validator;
}

/** Apply `withNanGuard` only when the caller named the narrower guard alone. */
export function maybeNan(
  name: string,
  opts: FiniteGrounding,
  validator: PropertyValidator
): PropertyValidator {
  return opts.nan && !opts.finite ? withNanGuard(validator, name, opts.nan) : validator;
}

/**
 * Tag a validator with its bounds, their tiers and its grounding, which
 * `boundGrounding.test.ts` sweeps in the live registry. A bound with neither
 * `enforced` nor `hinted` errors, and the sweep fails on it.
 */
export function ground(
  validator: PropertyValidator,
  opts: EndedGrounding,
  /**
   * The bound per end, by value, since a guard compares it against the engine's
   * `PROPERTY_HINT_RANGE`. An absent end is open, so `v.float('width')` is a
   * format check. `min`/`max` are the hint's outer ends, and `enforcedMin`/
   * `enforcedMax` the setter's own, which error from further out.
   */
  bounds: {
    min?: number;
    max?: number;
    enforcedMin?: EnforcedEnd;
    enforcedMax?: EnforcedEnd;
    /**
     * Every value in range, where they are not the whole span between the ends.
     * A `PROPERTY_HINT_ENUM` whose labels carry `:value` suffixes can skip one,
     * and `min`/`max` alone would tell a guard the gap is in range.
     */
    values?: readonly number[];
  } = {}
): PropertyValidator {
  const hasMin = bounds.min !== undefined;
  const hasMax = bounds.max !== undefined;
  // A setter end rejects real values just as a hint end does, so a validator
  // carrying only one is bounded and owes a citation.
  const isBounded =
    hasMin || hasMax || bounds.enforcedMin !== undefined || bounds.enforcedMax !== undefined;
  // Here, not in the range factories: every combinator passes through this
  // function, including those built from an inline arrow, such as `v.strictInt`.
  if (isBounded) {
    validator.bounds = bounds;
    // The tier of the outer end, the hint's, for a value between it and the
    // setter's own end, which always errors. An end with only a setter limit
    // errors too, so the sheet's out-of-range cell is never blank.
    const separate = { min: bounds.enforcedMin !== undefined, max: bounds.enforcedMax !== undefined };
    const tierFor = (end: 'min' | 'max') =>
      (end === 'min' ? hasMin : hasMax) ? endSeverity({ ...opts, ...bounds }, end) : 'error';
    validator.tiers = {
      ...(hasMin || separate.min ? { min: tierFor('min') } : {}),
      ...(hasMax || separate.max ? { max: tierFor('max') } : {}),
    };
  }
  // Every distinct citation, across both kinds and both ends, so the citation
  // sweep sees each: `extra_cull_margin` grounds its ends differently, and
  // `Control.anchors_preset` has a distinct enforced cite per end.
  const enforced = distinctCites(opts.enforced);
  const hinted = distinctCites(opts.hinted);
  if (enforced.length > 0) {
    const both = [...enforced, ...hinted.filter((cite) => !enforced.includes(cite))];
    validator.grounding = { kind: 'enforced', cite: both.join(', ') };
  } else if (hinted.length > 0) {
    validator.grounding = { kind: 'hinted', cite: hinted.join(', ') };
  }
  // An unbounded numeric combinator rejects only what is not a number, which
  // is the same class of rejection every `shape` makes.
  if (!isBounded) validator.formatOnly = true;
  return validator;
}

/**
 * Whether the hint's end at `end` describes a band any value can land in.
 * `exclusive` moves the endpoint, not the band: `[at, min)` and `(at, min)` are
 * both non-empty exactly when `at < min`. `lintCoverage.mjs` computes the same for
 * the sheet, and `boundGrounding.tiers.test.ts` sweeps for disagreement.
 */
export function outerEndIsReachable(bounds: EndedGrounding, end: 'min' | 'max'): boolean {
  const hintEnd = end === 'min' ? bounds.min : bounds.max;
  if (hintEnd === undefined) return false;
  const setterEnd = end === 'min' ? bounds.enforcedMin : bounds.enforcedMax;
  if (setterEnd === undefined) return true;
  return end === 'min' ? setterEnd.at < hintEnd : setterEnd.at > hintEnd;
}

/**
 * Severity for one end of a bound (ADR-0032): `warning` when only a hint names
 * it, `error` when the setter does. An end neither names errors.
 */
export function endSeverity(opts: EndedGrounding, end: 'min' | 'max'): Severity {
  // A setter limit strictly further out than the hint's end leaves the band
  // between them to the hint, which warns. At or inside the hint's end there is
  // no such band, so the end keeps the enforced tier.
  const setterEnd = end === 'min' ? opts.enforcedMin : opts.enforcedMax;
  const separateEnforcedEnd = setterEnd !== undefined && outerEndIsReachable(opts, end);
  if (!separateEnforcedEnd && citeFor(opts.enforced, end)) return 'error';
  return citeFor(opts.hinted, end) ? 'warning' : 'error';
}

/**
 * A `Grounding` alongside both ends, hint and setter: a tier is decided by
 * where the two sit relative to each other, so neither half can be dropped.
 */
export type EndedGrounding = Grounding & {
  min?: number;
  max?: number;
  enforcedMin?: EnforcedEnd;
  enforcedMax?: EnforcedEnd;
};
