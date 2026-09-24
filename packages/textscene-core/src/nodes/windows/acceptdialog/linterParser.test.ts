/**
 * AcceptDialog strict validators, asserted through `validatorRegistry` so a failure
 * points at the validator, not at scene parsing. Each numeric bound quotes its
 * Godot source line.
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
    // A validator that accepts arbitrary prose validates no format. The
    // per-property cases follow.
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
