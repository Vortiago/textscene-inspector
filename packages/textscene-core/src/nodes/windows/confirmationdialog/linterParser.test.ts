/**
 * ConfirmationDialog strict validators — format and range checks.
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
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ConfirmationDialog', property);
  expect(validator, `no validator registered for ConfirmationDialog.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ConfirmationDialog strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('ConfirmationDialog')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('ConfirmationDialog')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('cancel_button_text', () => {
    it('accepts a quoted string', () => {
      expect(check('cancel_button_text', '"No thanks"')).toBeNull();
    });

    it('accepts an empty quoted string (falls back to the default Cancel label)', () => {
      expect(check('cancel_button_text', '""')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('cancel_button_text', 'No thanks')?.message).toContain('quoted');
    });
  });

  describe('inheritance through the base-walk', () => {
    it('resolves an inherited AcceptDialog key (dialog_text) on ConfirmationDialog', () => {
      expect(check('dialog_text', '"Are you sure?"')).toBeNull();
    });

    it('resolves an inherited Window key (title) two hops up, through AcceptDialog', () => {
      expect(check('title', '"Please Confirm..."')).toBeNull();
    });

    it('resolves another inherited Window key (min_size) two hops up', () => {
      expect(check('min_size', 'Vector2i(200, 70)')).toBeNull();
    });
  });
});
