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

import { validatorRegistry } from '../ValidatorRegistry.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

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
 * Every key that resolves to a validator, declarations AND removals.
 *
 * Removals are the third population: `getOwnKeys` deliberately omits them (a
 * removal is not a declaration), so a sweep built on it alone cannot see a
 * rejection that refuses every value of the key outright.
 */
export function classifiableKeys(): { nodeType: string; key: string }[] {
  const out: { nodeType: string; key: string }[] = [];
  for (const nodeType of validatorRegistry.getRegisteredNodeTypes()) {
    for (const key of validatorRegistry.getOwnKeys(nodeType)) out.push({ nodeType, key });
  }
  // A separate walk, not a nested loop: a type that ONLY removes never appears
  // in the validator map, so folding removals into the loop above visited none
  // of them.
  for (const nodeType of validatorRegistry.getTypesWithRemovals()) {
    for (const key of Object.keys(validatorRegistry.getOwnRemovals(nodeType))) {
      out.push({ nodeType, key });
    }
  }
  return out;
}

/**
 * Every registered validator that declares none of the three classification tags,
 * counting a wildcard dispatcher's leaves as separate validators.
 *
 * Without the recursion a dispatcher's own tag would vouch for every bound
 * behind it: `Generic6DOFJoint3D` registers 18 wildcard keys covering 27 leaf
 * validators, and the sweep saw 18 functions.
 */
export function unclassifiedKeys(): string[] {
  return ungroundedLabels(UNGROUNDABLE);
}

/**
 * Every registered validator and every leaf behind a wildcard dispatcher, with
 * the label each is reported under, sorted.
 *
 * One walker for every registry-wide validator sweep. A second copy of it drifted
 * within hours of being written: `boundGrounding`'s citation sweep grew a
 * cycle-safety `Set` that this one lacked, so a shared leaf instance was walked
 * once there and repeatedly here. `keep` is the only thing a sweep should have
 * to supply.
 */
export function sweepValidators(
  keep: (validator: PropertyValidator) => boolean,
  roots: readonly Root[] = registryRoots()
): string[] {
  return collectValidators(keep, roots)
    .map(({ label }) => label)
    .sort();
}

/**
 * The same walk, keeping the validator beside its label.
 *
 * A sweep that only needs to NAME what it found takes `sweepValidators`; one
 * that has to CALL what it found — the non-finite int probe does — needs the
 * object. Sharing the walk is the point: the int sweep built its own population
 * from `getOwnKeys` and never descended `leaves`, so every slot behind a
 * wildcard dispatcher was outside it.
 */
export function collectValidators(
  keep: (validator: PropertyValidator) => boolean,
  /**
   * What to walk. Defaults to the live registry; a test passes scratch
   * validators so the walk itself can be proven to reach leaves and to dedupe,
   * without the guard's bite resting on whatever the registry happens to hold.
   */
  roots: readonly Root[] = registryRoots()
): Root[] {
  const out: Root[] = [];
  // A leaf instance can be shared between dispatchers, so a plain recursion
  // reports it once per parent.
  const seen = new Set<PropertyValidator>();

  const visit = (validator: PropertyValidator, label: string): void => {
    if (seen.has(validator)) return;
    seen.add(validator);
    if (keep(validator)) out.push({ label, validator });
    validator.leaves?.forEach((leaf, index) => visit(leaf, `${label}[${index}]`));
  };

  for (const { label, validator } of roots) visit(validator, label);
  return out;
}

/** A validator and the label a sweep reports it under. */
export interface Root {
  label: string;
  validator: PropertyValidator;
}

/** Every `Type.key` the registry resolves, as sweep roots. */
function registryRoots(): Root[] {
  const roots: Root[] = [];
  for (const { nodeType, key } of classifiableKeys()) {
    const validator = validatorRegistry.findValidator(nodeType, key);
    if (validator) roots.push({ label: `${nodeType}.${key}`, validator });
  }
  return roots;
}

/** The sweep, with the exemption set as a parameter so it can be emptied. */
function ungroundedLabels(exempt: ReadonlySet<string>, roots?: readonly Root[]): string[] {
  // The exemption is applied to the LABEL after the walk, never inside `keep`:
  // excusing a validator must not excuse the subtree behind it, and one exempt
  // wildcard key would otherwise cover every leaf it dispatches to.
  return sweepValidators(isUnclassified, roots ?? registryRoots()).filter((l) => !exempt.has(l));
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
  return sweepValidators(
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
