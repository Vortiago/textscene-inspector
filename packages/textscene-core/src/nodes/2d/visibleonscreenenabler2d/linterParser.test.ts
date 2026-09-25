/**
 * VisibleOnScreenEnabler2D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts. Each property gets happy, malformed and bound
 * cases, with the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('VisibleOnScreenEnabler2D', property);
  expect(validator, `no validator registered for VisibleOnScreenEnabler2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys VisibleOnScreenEnabler2D binds, read from the source. Set this or DECLARES_NOTHING,
 * not both. Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = ['enable_mode', 'enable_node_path'];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys VisibleOnScreenEnabler2D does not declare, each paired with the ancestor that does. The
 * malformed-value check below iterates `getOwnKeys`, so on a class with no own keys it passes on
 * an empty set. Resolving a key to the ancestor's own validator function tells "no own
 * properties" from "slice not written", and an empty list is red for the same reason KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  // The notifier's own shape key: the Enabler adds only the enable_* pair, so this must resolve
  // to the parent's function.
  ['VisibleOnScreenNotifier2D', 'rect'],
];

describe('VisibleOnScreenEnabler2D strict validators', () => {
  it('registers exactly what VisibleOnScreenEnabler2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('VisibleOnScreenEnabler2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-visible-on-screen-enabler-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('VisibleOnScreenEnabler2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key VisibleOnScreenEnabler2D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // VisibleOnScreenEnabler2D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('VisibleOnScreenEnabler2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('VisibleOnScreenEnabler2D')).not.toContain(key);
    }
  });
});

describe('VisibleOnScreenEnabler2D.enable_mode', () => {
  it('accepts every value the hint offers', () => {
    for (const value of ['0', '1', '2']) expect(check('enable_mode', value)).toBeNull();
  });

  it('warns outside the enum rather than erroring, since the setter bare-assigns', () => {
    // set_enable_mode has no ERR_FAIL_INDEX, so the value loads and only the
    // inspector dropdown excludes it.
    expect(check('enable_mode', '3')?.severity).toBe('warning');
    expect(check('enable_mode', '-1')?.severity).toBe('warning');
  });

  it('rejects a non-integer mode', () => {
    expect(check('enable_mode', '"always"')).not.toBeNull();
  });
});

describe('VisibleOnScreenEnabler2D.enable_node_path', () => {
  it('accepts the NodePath literal Godot writes', () => {
    expect(check('enable_node_path', 'NodePath("../Target")')).toBeNull();
  });

  it('accepts an empty NodePath, the documented affect-nothing state', () => {
    expect(check('enable_node_path', 'NodePath("")')).toBeNull();
  });

  // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
  it('takes the bare string the slot converts and rejects a StringName', () => {
    expect(check('enable_node_path', '"../Target"')).toBeNull();
    expect(check('enable_node_path', '&"../Target"')).not.toBeNull();
  });
});

describe('VisibleOnScreenEnabler2D inherits the notifier shape key', () => {
  it("applies the parent's bound rather than accepting anything", () => {
    // Resolving proves it routes; rejecting proves the bound survived the hop.
    expect(check('rect', 'Rect2(0, 0, 100, 100)')).toBeNull();
    expect(check('rect', 'not-a-shape')).not.toBeNull();
  });
});
