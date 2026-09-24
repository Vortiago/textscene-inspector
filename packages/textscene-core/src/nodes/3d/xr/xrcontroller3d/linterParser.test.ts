/**
 * XRController3D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts. Each property gets happy, malformed and bound
 * cases, with the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { checkerFor } from '../../../../linter/testing/validatorCheck';
import './linterParser';

/** `XRController3D.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('XRController3D');

/**
 * The keys XRController3D binds, read from the source. Set this or DECLARES_NOTHING,
 * not both. Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: XRController3D binds nothing beyond XRNode3D. `xr_nodes.h:133-156` is the whole class body,
 * and `xr_nodes.cpp:524-538`'s `_bind_methods` binds only passthrough methods and five signals, with
 * no property-list override. `doc/classes/XRController3D.xml` carries no `<members>` block.
 */
const DECLARES_NOTHING = true;

/**
 * Keys XRController3D does not declare, each paired with the ancestor that does. The
 * malformed-value check below iterates `getOwnKeys`, so on a class with no own keys it passes on
 * an empty set. Resolving a key to the ancestor's own validator function tells "no own
 * properties" from "slice not written", and an empty list is red for the same reason KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [['XRNode3D', 'tracker']];

describe('XRController3D strict validators', () => {
  it('registers exactly what XRController3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('XRController3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint` checks
    // it against the whole registry through the barrel. This checks it against only what this test
    // imported: with no own keys, the inherited validators, since `linterParser` imports the parent
    // chain, so it covers what XRNode3D up declares until KEYS gains an entry.
    expectFixtureClean('unit-xr-controller-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('XRController3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key XRController3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // XRController3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('XRController3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('XRController3D')).not.toContain(key);
    }
  });
});
