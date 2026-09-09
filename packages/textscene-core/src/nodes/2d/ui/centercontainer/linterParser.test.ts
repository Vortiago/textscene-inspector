/**
 * CenterContainer strict validators — format only, so the only failure is an
 * error (an unparseable boolean literal). `use_top_left` carries no
 * PROPERTY_HINT_RANGE/ENUM and its setter has no ERR_FAIL or clamp
 * (center_container.cpp:50-58), so there is no range branch to test.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CenterContainer', property);
  expect(validator, `no validator registered for CenterContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * doc/classes/CenterContainer.xml declares exactly one member without an
 * `overrides=` attribute: `use_top_left`. `Container::_bind_methods`
 * (container.cpp:217) binds no ADD_PROPERTY at all, so nothing else is
 * CenterContainer's own; everything else arrives through the base-walk.
 */
const KEYS: string[] = ['use_top_left'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('CenterContainer strict validators', () => {
  it('registers exactly what CenterContainer binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('CenterContainer').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-center-container.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; the per-property case follows.
    const accepted = validatorRegistry
      .getOwnKeys('CenterContainer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('use_top_left', () => {
    it('accepts false (the documented default, CenterContainer.xml:13)', () => {
      expect(check('use_top_left', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('use_top_left', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('use_top_left', 'topleft')).not.toBeNull();
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a Control key (anchor_right) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('CenterContainer', 'anchor_right')).not.toBeNull();
    });

    it('resolves a CanvasItem key (modulate) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('CenterContainer', 'modulate')).not.toBeNull();
    });
  });
});
