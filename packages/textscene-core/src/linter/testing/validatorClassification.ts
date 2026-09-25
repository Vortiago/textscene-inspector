/**
 * The population `boundGrounding.test.ts` sweeps: every key that resolves to a
 * validator, and which of those declare none of `formatOnly`, `grounding` or
 * `intSlot`, shared by the sweep and the tests that prove it bites. It reads the
 * live singleton, so a caller imports the linter barrel and asserts a count floor.
 */

import type { PropertyValidator } from '../ValidatorRegistry.js';
import { everyValidatorLabel, type Root } from '../registryPopulation.js';

/**
 * Bounds that cannot be grounded against the pinned reference. Empty by policy:
 * ADR-0032 puts an uncitable bound at the "nothing" tier, so the validator drops
 * the bound instead of being listed here.
 */
const UNGROUNDABLE: ReadonlySet<string> = new Set<string>();

/**
 * The sweep, with the exemption set as a parameter so it can be emptied.
 * The exemption applies to the label after the walk, not inside `keep`: one
 * exempt wildcard key would otherwise cover every leaf it dispatches to.
 */
function ungroundedLabels(exempt: ReadonlySet<string>, roots?: readonly Root[]): string[] {
  return everyValidatorLabel(isUnclassified, { roots }).filter((l) => !exempt.has(l));
}

/** Every registered validator that declares none of the three classification tags. */
export function unclassifiedKeys(): string[] {
  return ungroundedLabels(UNGROUNDABLE);
}

/**
 * A validator that names no authority for its rejections. `intSlot` classifies
 * only an unbounded validator, since the slot's own refusal is cited centrally.
 * A bounded one, such as `v.strictInt('s', { min: 0, max: 9 })`, still owes a
 * citation for its bound.
 */
export function isUnclassified(v: PropertyValidator): boolean {
  if (v.formatOnly || v.grounding) return false;
  return !(v.intSlot && v.bounds === undefined);
}

/**
 * An `accepts` string that states a numeric range: `float 0-1`, `integer >= 0`,
 * `enum 0-3 (…)`. A bare `float` or a `Vector3(x, y, z)` states none.
 */
const STATES_A_RANGE = /^(?:float|integer) (?:-?[\d.]+-|>= |<= )|^enum -?\d+-/;

/**
 * Validators whose `accepts` states a range while `tiers` says nothing about
 * exceeding it. The generated sheet renders both cells side by side, so they
 * must agree. Keyed on `accepts`, not `grounding`: a grounded validator can
 * bound a flags mask or an element type, which has no ends to report.
 */
export function rangeWithoutTiers(): string[] {
  return everyValidatorLabel(
    (v) => v.accepts !== undefined && STATES_A_RANGE.test(v.accepts) && v.tiers === undefined
  );
}

/**
 * Exemptions that exempt nothing: the label resolves to no ungrounded
 * validator. The check empties the set and reads the sweep's own output, so it
 * cannot disagree with the sweep about a label. A dead entry pre-forgives the
 * next validator registered under that name.
 */
export function staleUngroundable(
  entries: ReadonlySet<string> = UNGROUNDABLE,
  /**
   * What the labels resolve against: the live registry by default. A test
   * supplies scratch roots, because the live ungrounded population is empty by
   * policy and the arm that must not report needs a subject.
   */
  roots?: readonly Root[]
): string[] {
  const ungrounded = new Set(ungroundedLabels(new Set(), roots));
  return [...entries].filter((label) => !ungrounded.has(label)).sort();
}
