/**
 * The population `boundGrounding.test.ts` sweeps: every key that resolves to a
 * validator, and which of those declare none of `formatOnly`, `grounding` or
 * `intSlot`.
 *
 * Shared so the sweep and the tests that prove the sweep BITES read the same
 * key list — a guard whose fixture and whose subject drift apart stops
 * protecting anything. Reads the live singleton, so a caller must have imported
 * the linter barrel first; every consumer asserts a floor on the count for
 * exactly that reason.
 */

import type { PropertyValidator } from '../ValidatorRegistry.js';
import { everyValidatorLabel, type Root } from '../registryPopulation.js';

/**
 * The one bound that cannot be grounded against the pinned reference, with the
 * reason.
 *
 * Empty, and meant to stay that way. A bound nobody can cite is not an
 * exemption to record but a bound ADR-0032 puts at the "nothing" tier: a hint
 * can only warn, only a setter can error, and a class absent from the pinned
 * reference offers neither. The validator drops the bound instead of being
 * listed here.
 */
const UNGROUNDABLE: ReadonlySet<string> = new Set<string>();

/**
 * The sweep, with the exemption set as a parameter so it can be emptied.
 *
 * The exemption is applied to the LABEL after the walk, never inside `keep`:
 * excusing a validator must not excuse the subtree behind it, and one exempt
 * wildcard key would otherwise cover every leaf it dispatches to.
 */
function ungroundedLabels(exempt: ReadonlySet<string>, roots?: readonly Root[]): string[] {
  return everyValidatorLabel(isUnclassified, { roots }).filter((l) => !exempt.has(l));
}

/** Every registered validator that declares none of the three classification tags. */
export function unclassifiedKeys(): string[] {
  return ungroundedLabels(UNGROUNDABLE);
}

/**
 * A validator nobody has said where the authority for its rejections comes from.
 *
 * `intSlot` classifies only an UNBOUNDED validator. The slot's own refusal is
 * cited once, centrally, and covers `v.lenientInt('limit_left')`, which rejects
 * nothing else. A bounded one still owes a citation for the bound: without this
 * split, `v.strictInt('s', { min: 0, max: 9 })` with no `enforced:`/`hinted:`
 * reported its range at error tier and the ratchet stayed green.
 */
export function isUnclassified(v: PropertyValidator): boolean {
  if (v.formatOnly || v.grounding) return false;
  return !(v.intSlot && v.bounds === undefined);
}

/**
 * An `accepts` string that states a numeric range — `float 0-1`, `integer >= 0`,
 * `enum 0-3 (…)`. A bare `float` or a `Vector3(x, y, z)` states none.
 */
const STATES_A_RANGE = /^(?:float|integer) (?:-?[\d.]+-|>= |<= )|^enum -?\d+-/;

/**
 * Validators whose `accepts` states a range while `tiers` says nothing about
 * exceeding it — the pairing the generated sheet renders side by side.
 *
 * The two cells come from one validator and must agree: a row reading
 * `integer 1-16384` beside an empty `Out of range` tells a reader the bound has
 * no consequence. `accepts` and `grounding` each already have a registry sweep;
 * `tiers` shipped without one and 55 validators built from an inline arrow
 * (`v.strictInt`, `v.positiveInt` and their kin) went untagged — including
 * three with an enforced floor and a hinted ceiling, the very split the field
 * exists to express.
 *
 * Keyed on `accepts` rather than on `grounding` because plenty of grounded
 * validators bound something other than a magnitude — a flags mask, an array's
 * element type — and have no ends to report.
 */
export function rangeWithoutTiers(): string[] {
  return everyValidatorLabel(
    (v) => v.accepts !== undefined && STATES_A_RANGE.test(v.accepts) && v.tiers === undefined
  );
}

/**
 * Exemptions that exempt nothing: the label resolves to no validator at all, or
 * to one that has since been grounded.
 *
 * Asked by emptying the set rather than by re-deriving each label, so the check
 * consumes the sweep's own output and cannot disagree with it about what a
 * label means. A dead entry is worse than none: it silently pre-forgives the
 * next validator to be registered under that exact name.
 */
export function staleUngroundable(
  entries: ReadonlySet<string> = UNGROUNDABLE,
  /**
   * What the labels are resolved against. The live registry by default; a test
   * supplies scratch roots because the ungrounded population is empty by
   * policy, so against the registry alone every label is stale and the arm that
   * must NOT report has no live subject to stand on.
   */
  roots?: readonly Root[]
): string[] {
  const ungrounded = new Set(ungroundedLabels(new Set(), roots));
  return [...entries].filter((label) => !ungrounded.has(label)).sort();
}
