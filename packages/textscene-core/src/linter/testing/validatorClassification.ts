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
 * The one bound that cannot be grounded, with the reason.
 *
 * `AreaLight3D` does not exist anywhere in Godot 4.6.3, so it has no
 * ADD_PROPERTY hint and no setter to cite. Its slice sheet records that the
 * node postdates this engine build. Guessing a citation would be worse than
 * admitting there is none, so the bound stays an ungrounded error and is named
 * here rather than hidden in a count.
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
  const out: string[] = [];

  const visit = (validator: PropertyValidator, label: string): void => {
    // The exemption covers THIS validator, never its subtree: returning early
    // would let one exempt wildcard key excuse every leaf behind it.
    if (!UNGROUNDABLE.has(label) && !validator.formatOnly && !validator.grounding) {
      out.push(label);
    }
    validator.leaves?.forEach((leaf, index) => visit(leaf, `${label}[${index}]`));
  };

  for (const { nodeType, key } of classifiableKeys()) {
    const validator = validatorRegistry.findValidator(nodeType, key);
    if (validator) visit(validator, `${nodeType}.${key}`);
  }
  return out.sort();
}
