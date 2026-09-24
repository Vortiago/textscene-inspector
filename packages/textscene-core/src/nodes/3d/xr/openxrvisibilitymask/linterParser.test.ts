/**
 * OpenXRVisibilityMask strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts. Each property gets happy, malformed and bound
 * cases, with the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { checkerFor } from '../../../../linter/testing/validatorCheck';
import './linterParser';
// The fixture's parent placement (linter.ts, valid-openxrvisibilitymask-parent)
// requires an XRCamera3D sibling in the same file. `expectFixtureClean` only
// sees registrations THIS test imported, so without these two the XRCamera3D
// heading would go unchecked rather than proven clean.
import '../../camera3d/linterParser';
import '../../camera3d/linter';

/** `OpenXRVisibilityMask.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('OpenXRVisibilityMask');

/**
 * The keys OpenXRVisibilityMask binds, read from the source. Set this or DECLARES_NOTHING,
 * not both. Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: OpenXRVisibilityMask binds nothing. `openxr_visibility_mask.h:35-53` is the whole class
 * body, with an empty `_bind_methods` (`openxr_visibility_mask.cpp:37-38`) and no property-list
 * override in either spelling. `doc/classes/OpenXRVisibilityMask.xml` carries no `<members>` block.
 */
const DECLARES_NOTHING = true;

/**
 * Keys OpenXRVisibilityMask does not declare, each paired with the ancestor that does. The
 * malformed-value check below iterates `getOwnKeys`, so on a class with no own keys it passes on
 * an empty set. Resolving a key to the ancestor's own validator function tells "no own
 * properties" from "slice not written", and an empty list is red for the same reason KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  // visual_instance_3d.cpp:182, one hop up.
  ['VisualInstance3D', 'layers'],
];

describe('OpenXRVisibilityMask strict validators', () => {
  it('registers exactly what OpenXRVisibilityMask binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OpenXRVisibilityMask').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint` checks it
    // against the whole registry through the barrel. This checks it against only what this test
    // imported: with no own keys, the inherited validators, since `linterParser` imports the parent
    // chain, so it covers what GeometryInstance3D up declares until KEYS gains an entry.
    expectFixtureClean('unit-open-xr-visibility-mask.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('OpenXRVisibilityMask')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key OpenXRVisibilityMask inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // OpenXRVisibilityMask would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('OpenXRVisibilityMask', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('OpenXRVisibilityMask')).not.toContain(key);
    }
  });

  it('still fires through the walk on a layers mask no 32-bit slot holds', () => {
    // The inherited resolution has to reach the validator at all; `-1` is a
    // legal mask, `4294967296` drops a bit the file states.
    expect(check('layers', '4294967296')).not.toBeNull();
    expect(check('layers', '-1')).toBeNull();
  });

  it('accepts an in-range layers mask through the walk', () => {
    expect(check('layers', '3')).toBeNull();
  });

  it('invents no validator for a key nothing in the chain declares', () => {
    // The base-walk widens what a type accepts, so the failure mode worth
    // guarding is it answering for a key no ancestor ever bound.
    expect(validatorRegistry.findValidator('OpenXRVisibilityMask', 'not_a_real_property')).toBeNull();
  });
});
