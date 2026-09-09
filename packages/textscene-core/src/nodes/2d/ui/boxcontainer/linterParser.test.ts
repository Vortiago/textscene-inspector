/**
 * BoxContainer strict validators — format and range checks.
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
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('BoxContainer', property);
  expect(validator, `no validator registered for BoxContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('BoxContainer strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('BoxContainer')).not.toEqual([]);
  });

  it('registers exactly the 2 own members from doc/classes/BoxContainer.xml (no overrides=)', () => {
    expect(validatorRegistry.getOwnKeys('BoxContainer').sort()).toEqual(['alignment', 'vertical']);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('BoxContainer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('alignment (enum 0-2)', () => {
    // box_container.cpp _bind_methods: BIND_ENUM_CONSTANT ALIGNMENT_BEGIN=0,
    // ALIGNMENT_CENTER=1, ALIGNMENT_END=2.
    it('accepts 0 (ALIGNMENT_BEGIN, the documented default)', () => {
      expect(check('alignment', '0')).toBeNull();
    });

    it('accepts 1 (ALIGNMENT_CENTER)', () => {
      expect(check('alignment', '1')).toBeNull();
    });

    it('accepts 2 (ALIGNMENT_END)', () => {
      expect(check('alignment', '2')).toBeNull();
    });

    it('rejects a value beyond the enum (3)', () => {
      expect(check('alignment', '3')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('alignment', '-1')).not.toBeNull();
    });
  });

  describe('vertical (boolean)', () => {
    // box_container.cpp _bind_methods: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
    // "vertical")). Serialisable on a plain BoxContainer — see linterParser.ts's
    // file header for why HBoxContainer/VBoxContainer don't carry this same rule.
    it('accepts true', () => {
      expect(check('vertical', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('vertical', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('vertical', 'yes')).not.toBeNull();
    });
  });

  describe('inheritance through the base-walk', () => {
    it('resolves an inherited Control key (anchor_right) on BoxContainer', () => {
      expect(check('anchor_right', '1.0')).toBeNull();
    });
  });
});
