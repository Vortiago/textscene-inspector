/**
 * Where a validator's authority comes from, and the tags that record it.
 *
 * `accepts` and `shape` declare what a validator takes and whether it rejects
 * anything a Godot-written scene could carry; `ground` and `endSeverity` turn a
 * `Grounding` into the ADR-0032 tier its range branch reports at. Every
 * combinator beside this file goes through one of them, which is what lets
 * `boundGrounding.test.ts` sweep the live registry for an unclassified one.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import type { Severity } from '../../types.js';
import { propertyError } from '../propertyError.js';
import { parseGodotFloat, type EnforcedEnd } from '../commonValidators.js';
import { valueCode } from './codes.js';

/**
 * Where a bound's authority comes from (ADR-0032). Exactly one of these belongs
 * on any validator carrying a numeric or enum bound, and each takes the
 * governing `file:line` so the claim is checkable.
 *
 * `enforced` — Godot's setter refuses or alters the value (`ERR_FAIL*`, a clamp,
 * a silently dropped write). Out of range is an ERROR.
 *
 * `hinted` — the property's `PROPERTY_HINT_RANGE` states the bound but the
 * setter assigns straight through. The hint constrains the inspector widget,
 * not the engine, so out of range is a WARNING.
 *
 * Neither is the un-audited legacy state: the bound behaves as an error and is
 * counted by `boundGrounding.test.ts`, whose ratchet only goes down.
 */
export interface Grounding {
  /**
   * `file:line` of the setter guard that refuses or alters the value. A bare
   * string grounds BOTH ends; `{ min, max }` grounds them separately, which
   * real properties need: `PhysicalBone2D.bone2d_index` has an `ERR_FAIL_COND`
   * on its floor and nothing but a hint on its ceiling.
   */
  enforced?: string | { min?: string; max?: string };
  /** `file:line` of the ADD_PROPERTY whose PROPERTY_HINT_RANGE states the bound. */
  hinted?: string | { min?: string; max?: string };
  /**
   * `file:line` of an `ERR_FAIL_COND(!is_finite(...))` in the setter.
   *
   * `inf` and `nan` are legal TSCN float literals that Godot writes and reloads
   * (`variant_parser.cpp:150-155`), so the shared numeric validator accepts
   * them. Exactly five setters in `scene/` refuse one, and each names its guard
   * here. Before this existed they were rejected everywhere by a `parseFloat`
   * accident, which was right for these five and a false positive on every
   * other float property.
   */
  finite?: string;
}

/** The citation covering one end of a bound, if the grounding names it. */
function citeFor(g: string | { min?: string; max?: string } | undefined, end: 'min' | 'max') {
  if (g === undefined) return undefined;
  return typeof g === 'string' ? g : g[end];
}

/**
 * Tag a validator with what it accepts, for the generated `## Linting` table.
 * Exported so a slice with a bespoke validator can describe it too — an
 * untagged one renders an empty cell, which `validatorAccepts.test.ts` fails on.
 */
export function accepts(validator: PropertyValidator, description: string): PropertyValidator {
  validator.accepts = description;
  return validator;
}

/**
 * `accepts`, plus the declaration that this validator rejects nothing but
 * malformed input. Every combinator below is either a `shape` or carries a
 * `Grounding`; `boundGrounding.test.ts` fails on one that is neither, so a new
 * combinator cannot quietly start rejecting real values uncited.
 *
 * Exported for the same reason as `accepts`: a slice with a bespoke validator
 * has to classify it too.
 */
export function shape(validator: PropertyValidator, description: string): PropertyValidator {
  validator.formatOnly = true;
  return accepts(validator, description);
}

/**
 * Reject `inf` / `-inf` / `inf_neg` / `nan` ahead of the range check, for the
 * handful of setters that open with `ERR_FAIL_COND(!is_finite(...))`.
 *
 * It runs FIRST because a range check cannot express it: `Infinity > max` is
 * true so a bounded property would report the wrong reason, and every NaN
 * comparison is false so an unbounded one would report nothing at all.
 */
export function withFiniteGuard(
  validator: PropertyValidator,
  name: string,
  cite: string
): PropertyValidator {
  const guarded: PropertyValidator = (key, value, line) => {
    const parsed = parseGodotFloat(value);
    if (parsed !== null && !Number.isFinite(parsed)) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be finite; Godot's setter refuses "${value.trim()}"`,
        valueCode(name)
      );
    }
    return validator(key, value, line);
  };
  guarded.accepts = validator.accepts;
  // The wrapper only adds a finiteness branch ahead of the range checks, so the
  // bounded ends, their tiers and the NUMBERS stay the inner validator's.
  // `bounds` is what `hintImplementationParity` compares against the engine's
  // hint, so dropping it took the property out of that comparison and counted
  // it as unimplemented while it was fully implemented.
  guarded.tiers = validator.tiers;
  guarded.bounds = validator.bounds;
  // `formatOnly` is deliberately NOT forwarded, even though it is dropped the
  // same way: `inf`/`nan` are legal TSCN float literals, so this guard rejects a
  // real value and owes a citation — which is exactly what `formatOnly` denies.
  //
  // Keep BOTH citations when the property also carries a range bound, the same
  // rule `ground` follows: the finite guard and the range guard are separate
  // lines in the setter, and dropping either makes it uncheckable.
  const inner = validator.grounding?.cite;
  guarded.grounding = {
    // The inner kind wins where there is one. The finite branch is always an
    // error and says so directly, so stamping `enforced` unconditionally would
    // only mislabel a `hinted:` bound whose range branch still warns.
    kind: validator.grounding?.kind ?? 'enforced',
    cite: inner && inner !== cite ? `${cite}, ${inner}` : cite,
  };
  return guarded;
}

/** Apply `withFiniteGuard` only when the caller named a guard. */
export function maybeFinite(
  name: string,
  opts: Grounding,
  validator: PropertyValidator
): PropertyValidator {
  return opts.finite ? withFiniteGuard(validator, name, opts.finite) : validator;
}

/**
 * Severity of a bound's range branch, and the tag that records why.
 *
 * A validator is tagged with its grounding so `boundGrounding.test.ts` can
 * sweep the live registry: a bound with neither `enforced` nor `hinted` is
 * un-audited, behaves as it always has, and is counted by the ratchet.
 */
export function ground(
  validator: PropertyValidator,
  opts: Grounding,
  /**
   * The bound this validator enforces, per end, by VALUE. An absent end is an
   * open one: `v.float('width')` with neither is a format check, so it needs no
   * grounding and must not be counted by the ratchet.
   *
   * Values rather than flags because two tags are derived from them — the
   * severity each end reports, and the bound itself, which a guard compares
   * against the engine's captured `PROPERTY_HINT_RANGE`.
   *
   * `min`/`max` are the OUTER ends, so they stay the hint's numbers where a
   * hint states them; `enforcedMin`/`enforcedMax` are the setter's own, which
   * report as errors from further out.
   */
  bounds: {
    min?: number;
    max?: number;
    enforcedMin?: EnforcedEnd;
    enforcedMax?: EnforcedEnd;
  } = {}
): PropertyValidator {
  const hasMin = bounds.min !== undefined;
  const hasMax = bounds.max !== undefined;
  // A setter end rejects real values just as a hint end does, so a validator
  // carrying only one is bounded and owes a citation.
  const isBounded =
    hasMin || hasMax || bounds.enforcedMin !== undefined || bounds.enforcedMax !== undefined;
  // Here rather than in the range factories, because this is the one function
  // every combinator passes through: tagging at the factories left the 55
  // validators built from an inline arrow — `v.strictInt`, `v.positiveInt` —
  // silently untagged, and the sheet rendered their tier blank.
  if (isBounded) {
    validator.bounds = bounds;
    // The tier of the OUTER end. Where the setter has an end of its own, that
    // one is always an error and lives in `bounds`, so this reports what a
    // value between the two says: the hint's tier, not the setter's.
    // An end with ONLY a setter limit still rejects values, and always as an
    // error. Leaving it out left `tiers` empty for every strictly-positive
    // property, and the generated sheet then rendered a blank out-of-range cell
    // for a validator that refuses.
    const separate = { min: bounds.enforcedMin !== undefined, max: bounds.enforcedMax !== undefined };
    const tierFor = (end: 'min' | 'max') =>
      (end === 'min' ? hasMin : hasMax) ? endSeverity(opts, end, separate[end]) : 'error';
    validator.tiers = {
      ...(hasMin || separate.min ? { min: tierFor('min') } : {}),
      ...(hasMax || separate.max ? { max: tierFor('max') } : {}),
    };
  }
  const enforced = citeFor(opts.enforced, 'min') ?? citeFor(opts.enforced, 'max');
  const hinted = citeFor(opts.hinted, 'min') ?? citeFor(opts.hinted, 'max');
  if (enforced) {
    // BOTH citations when the ends are grounded differently. Recording only the
    // enforced one discarded the hinted end's `file:line` entirely, so the
    // citation sweep could never see it and a wrong or malformed second-end
    // citation was unobservable. `extra_cull_margin` (an enforced floor and a
    // hinted ceiling) is the live shape.
    validator.grounding = {
      kind: 'enforced',
      cite: hinted && hinted !== enforced ? `${enforced}, ${hinted}` : enforced,
    };
  } else if (hinted) {
    validator.grounding = { kind: 'hinted', cite: hinted };
  }
  // An unbounded numeric combinator rejects only what is not a number, which
  // is the same class of rejection every `shape` makes.
  if (!isBounded) validator.formatOnly = true;
  return validator;
}

/**
 * Severity for one END of a bound (ADR-0032): `warning` when only a hint names
 * it, `error` when the setter does. Un-audited ends keep erroring, which is the
 * pre-split behaviour.
 */
export function endSeverity(
  opts: Grounding,
  end: 'min' | 'max',
  /**
   * True when the setter's own limit at this end is a SEPARATE, further-out
   * bound (`enforcedMin`/`enforcedMax`). The `enforced:` citation then belongs
   * to that one, and the end being scored here is the hint's, which warns.
   */
  separateEnforcedEnd = false
): Severity {
  if (!separateEnforcedEnd && citeFor(opts.enforced, end)) return 'error';
  return citeFor(opts.hinted, end) ? 'warning' : 'error';
}
