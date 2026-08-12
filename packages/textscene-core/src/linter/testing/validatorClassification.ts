/**
 * The population `boundGrounding.test.ts` sweeps: every key that resolves to a
 * validator, and which of those declare neither `formatOnly` nor `grounding`.
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
 * `AreaLight3D` postdates Godot 4.6.3 and appears nowhere in it, so there is no
 * ADD_PROPERTY hint and no setter to cite. The current class reference gives
 * `area_range` a default of 5.0 but never its hint, and a default is not a
 * bound. Guessing a citation would be worse than admitting there is none, so
 * the bound stays ungrounded and named here rather than hidden in a count; it
 * becomes citable the day the reference pin moves.
 */
const UNGROUNDABLE: ReadonlySet<string> = new Set(['AreaLight3D.area_range']);

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
 * Every registered validator that declares neither `formatOnly` nor `grounding`,
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
  /**
   * What to walk. Defaults to the live registry; a test passes scratch
   * validators so the walk itself can be proven to reach leaves and to dedupe,
   * without the guard's bite resting on whatever the registry happens to hold.
   */
  roots: readonly Root[] = registryRoots()
): string[] {
  const out: string[] = [];
  // A leaf instance can be shared between dispatchers, so a plain recursion
  // reports it once per parent.
  const seen = new Set<PropertyValidator>();

  const visit = (validator: PropertyValidator, label: string): void => {
    if (seen.has(validator)) return;
    seen.add(validator);
    if (keep(validator)) out.push(label);
    validator.leaves?.forEach((leaf, index) => visit(leaf, `${label}[${index}]`));
  };

  for (const { label, validator } of roots) visit(validator, label);
  return out.sort();
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
function ungroundedLabels(exempt: ReadonlySet<string>): string[] {
  // The exemption is applied to the LABEL after the walk, never inside `keep`:
  // excusing a validator must not excuse the subtree behind it, and one exempt
  // wildcard key would otherwise cover every leaf it dispatches to.
  return sweepValidators((v) => !v.formatOnly && !v.grounding).filter((l) => !exempt.has(l));
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
export function staleUngroundable(entries: ReadonlySet<string> = UNGROUNDABLE): string[] {
  const ungrounded = new Set(ungroundedLabels(new Set()));
  return [...entries].filter((label) => !ungrounded.has(label)).sort();
}
