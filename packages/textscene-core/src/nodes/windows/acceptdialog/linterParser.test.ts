/**
 * AcceptDialog strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('AcceptDialog', property);
  expect(validator, `no validator registered for AcceptDialog.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('AcceptDialog strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('AcceptDialog')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('AcceptDialog')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('dialog_text', () => {
    it('accepts a quoted string', () => {
      expect(check('dialog_text', '"Are you sure?"')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('dialog_text', 'Are you sure?')?.message).toContain('quoted');
    });
  });

  describe('ok_button_text', () => {
    it('accepts a quoted string', () => {
      expect(check('ok_button_text', '"Got it"')).toBeNull();
    });

    it('accepts an empty quoted string (falls back to the default OK label)', () => {
      expect(check('ok_button_text', '""')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('ok_button_text', 'Got it')?.message).toContain('quoted');
    });
  });

  describe('dialog_autowrap', () => {
    it('accepts true and false', () => {
      expect(check('dialog_autowrap', 'true')).toBeNull();
      expect(check('dialog_autowrap', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('dialog_autowrap', 'yes')?.message).toContain('boolean');
    });
  });

  describe('dialog_close_on_escape', () => {
    it('accepts true and false', () => {
      expect(check('dialog_close_on_escape', 'true')).toBeNull();
      expect(check('dialog_close_on_escape', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('dialog_close_on_escape', 'yes')?.message).toContain('boolean');
    });
  });

  describe('dialog_hide_on_ok', () => {
    it('accepts true and false', () => {
      expect(check('dialog_hide_on_ok', 'true')).toBeNull();
      expect(check('dialog_hide_on_ok', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('dialog_hide_on_ok', 'yes')?.message).toContain('boolean');
    });
  });

  describe('inheritance through the base-walk', () => {
    it('resolves an inherited Window key (title) on AcceptDialog', () => {
      expect(check('title', '"Alert!"')).toBeNull();
    });

    it('resolves another inherited Window key (min_size) on AcceptDialog', () => {
      expect(check('min_size', 'Vector2i(320, 240)')).toBeNull();
    });
  });
});
