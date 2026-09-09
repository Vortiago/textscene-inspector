/**
 * StatusIndicator strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('StatusIndicator', property);
  expect(validator, `no validator registered for StatusIndicator.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * StatusIndicator binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  // The 4 ADD_PROPERTY calls at status_indicator.cpp:87-90, in source order.
  'tooltip',
  'icon',
  'menu',
  'visible',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys StatusIndicator does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives StatusIndicator no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  // node.cpp — enum format-only validator; StatusIndicator declares no
  // Node-level key of its own, and its own `visible` is a distinct property
  // from anything Node/CanvasItem/Node3D would have declared.
  ['Node', 'process_mode'],
];

describe('StatusIndicator strict validators', () => {
  it('registers exactly what StatusIndicator binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('StatusIndicator').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-status-indicator.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // StatusIndicator declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('StatusIndicator')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key StatusIndicator inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // StatusIndicator would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('StatusIndicator', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('StatusIndicator')).not.toContain(key);
    }
  });

  describe('tooltip', () => {
    it('accepts a quoted string', () => {
      expect(check('tooltip', '"Server status"')).toBeNull();
    });
    it('accepts the documented default (empty string)', () => {
      expect(check('tooltip', '""')).toBeNull();
    });
    it('rejects an unquoted value', () => {
      expect(check('tooltip', 'Server status')).not.toBeNull();
    });
  });

  describe('icon', () => {
    it('accepts a SubResource reference', () => {
      expect(check('icon', 'SubResource("Texture2D_1")')).toBeNull();
    });
    it('accepts an ExtResource reference', () => {
      expect(check('icon', 'ExtResource("1_icon")')).toBeNull();
    });
    it('rejects a bare identifier', () => {
      expect(check('icon', 'not_a_resource')).not.toBeNull();
    });
  });

  describe('menu', () => {
    it('accepts a NodePath literal', () => {
      expect(check('menu', 'NodePath("../PopupMenu")')).toBeNull();
    });
    it('accepts the documented default (empty NodePath)', () => {
      expect(check('menu', 'NodePath("")')).toBeNull();
    });
    it('rejects a bare identifier', () => {
      expect(check('menu', 'PopupMenu')).not.toBeNull();
    });
  });

  describe('visible', () => {
    it('accepts true', () => {
      expect(check('visible', 'true')).toBeNull();
    });
    it('accepts false', () => {
      expect(check('visible', 'false')).toBeNull();
    });
    it('rejects a non-boolean value', () => {
      expect(check('visible', '1')).not.toBeNull();
    });
  });
});
