/**
 * VisibleOnScreenEnabler3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('VisibleOnScreenEnabler3D', property);
  expect(validator, `no validator registered for VisibleOnScreenEnabler3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * VisibleOnScreenEnabler3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = ['enable_mode', 'enable_node_path'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys VisibleOnScreenEnabler3D does NOT declare, each paired with the ancestor that does.
 * Name at least one; VisibleOnScreenNotifier3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives VisibleOnScreenEnabler3D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  // The notifier's own shape key: the Enabler adds the enable_* pair and
  // nothing else, so this must resolve to the PARENT's function.
  ['VisibleOnScreenNotifier3D', 'aabb'],
];

describe('VisibleOnScreenEnabler3D strict validators', () => {
  it('registers exactly what VisibleOnScreenEnabler3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('VisibleOnScreenEnabler3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-visible-on-screen-enabler-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // VisibleOnScreenEnabler3D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('VisibleOnScreenEnabler3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key VisibleOnScreenEnabler3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // VisibleOnScreenEnabler3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('VisibleOnScreenEnabler3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('VisibleOnScreenEnabler3D')).not.toContain(key);
    }
  });
});

describe('VisibleOnScreenEnabler3D.enable_mode', () => {
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

describe('VisibleOnScreenEnabler3D.enable_node_path', () => {
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

describe('VisibleOnScreenEnabler3D inherits the notifier shape key', () => {
  it("applies the parent's bound rather than accepting anything", () => {
    // Resolving proves it routes; rejecting proves the bound survived the hop.
    expect(check('aabb', 'AABB(0, 0, 0, 1, 1, 1)')).toBeNull();
    expect(check('aabb', 'not-a-shape')).not.toBeNull();
  });
});
