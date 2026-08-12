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
import { parseGodotFloat } from '../commonValidators.js';
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
  // bounded ends and their tiers are the inner validator's unchanged.
  guarded.tiers = validator.tiers;
  // Keep BOTH citations when the property also carries a range bound, the same
  // rule `ground` follows: the finite guard and the range guard are separate
  // lines in the setter, and dropping either makes it uncheckable.
  const inner = validator.grounding?.cite;
  guarded.grounding = {
    kind: 'enforced',
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
   * Whether this validator actually constrains a range. `v.float('width')` with
   * no min or max is a format check, so it needs no grounding and must not be
   * counted by the ratchet: marking every validator bounded inflated the count
   * with properties that have nothing to ground.
   */
  isBounded = true
): PropertyValidator {
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
export function endSeverity(opts: Grounding, end: 'min' | 'max'): Severity {
  if (citeFor(opts.enforced, end)) return 'error';
  return citeFor(opts.hinted, end) ? 'warning' : 'error';
}
