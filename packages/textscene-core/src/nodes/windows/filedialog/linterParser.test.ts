/**
 * FileDialog strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('FileDialog', property);
  expect(validator, `no validator registered for FileDialog.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('FileDialog strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('FileDialog')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('FileDialog')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('mode_overrides_title', () => {
    it('accepts true and false', () => {
      expect(check('mode_overrides_title', 'true')).toBeNull();
      expect(check('mode_overrides_title', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('mode_overrides_title', 'yes')?.message).toContain('boolean');
    });
  });

  describe('file_mode', () => {
    it('accepts every enum value 0-4', () => {
      for (const value of ['0', '1', '2', '3', '4']) {
        expect(check('file_mode', value)).toBeNull();
      }
    });

    it('rejects a non-numeric value', () => {
      expect(check('file_mode', 'open')?.message).toContain('number');
    });

    it('rejects 5 as an error (set_file_mode ERR_FAIL_INDEXes at 5)', () => {
      const error = check('file_mode', '5');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('0-4');
    });

    it('rejects a negative index as an error', () => {
      expect(check('file_mode', '-1')?.severity).toBe('error');
    });
  });

  describe('display_mode', () => {
    it('accepts 0 and 1', () => {
      expect(check('display_mode', '0')).toBeNull();
      expect(check('display_mode', '1')).toBeNull();
    });

    it('rejects 2 as an error (set_display_mode ERR_FAIL_INDEXes at DISPLAY_MAX = 2)', () => {
      const error = check('display_mode', '2');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('0-1');
    });
  });

  describe('access', () => {
    it('accepts every enum value 0-2', () => {
      for (const value of ['0', '1', '2']) {
        expect(check('access', value)).toBeNull();
      }
    });

    it('rejects 3 as an error (set_access ERR_FAIL_INDEXes at 3)', () => {
      const error = check('access', '3');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('0-2');
    });
  });

  describe('root_subfolder', () => {
    it('accepts a quoted string', () => {
      expect(check('root_subfolder', '"levels"')).toBeNull();
    });

    it('accepts an empty quoted string (no root restriction)', () => {
      expect(check('root_subfolder', '""')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('root_subfolder', 'levels')?.message).toContain('quoted');
    });
  });

  describe('filters', () => {
    it('accepts an empty PackedStringArray', () => {
      expect(check('filters', 'PackedStringArray()')).toBeNull();
    });

    it('accepts a single quoted filter', () => {
      expect(check('filters', 'PackedStringArray("*.png, *.jpg")')).toBeNull();
    });

    it('accepts multiple quoted filters, commas inside a filter string included', () => {
      expect(
        check(
          'filters',
          'PackedStringArray("*.png,*.jpg,*.jpeg;Image Files;image/png,image/jpeg", "*.tscn")'
        )
      ).toBeNull();
    });

    it('rejects a value with no PackedStringArray wrapper', () => {
      expect(check('filters', '"*.png"')?.message).toContain('PackedStringArray');
    });

    it('rejects an unquoted element', () => {
      expect(check('filters', 'PackedStringArray(*.png)')?.message).toContain('non-string');
    });
  });

  describe('filename_filter', () => {
    it('accepts a quoted string', () => {
      expect(check('filename_filter', '"level"')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('filename_filter', 'level')?.message).toContain('quoted');
    });
  });

  describe('show_hidden_files', () => {
    it('accepts true and false', () => {
      expect(check('show_hidden_files', 'true')).toBeNull();
      expect(check('show_hidden_files', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('show_hidden_files', 'yes')?.message).toContain('boolean');
    });
  });

  describe('use_native_dialog', () => {
    it('accepts true and false', () => {
      expect(check('use_native_dialog', 'true')).toBeNull();
      expect(check('use_native_dialog', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('use_native_dialog', 'yes')?.message).toContain('boolean');
    });
  });

  describe('option_count', () => {
    it('accepts zero and a positive count', () => {
      expect(check('option_count', '0')).toBeNull();
      expect(check('option_count', '2')).toBeNull();
    });

    it('rejects a non-integer', () => {
      expect(check('option_count', '1.5')?.message).toContain('integer');
    });

    it('rejects a negative count as an error (set_option_count ERR_FAIL_CONDs below 0)', () => {
      const error = check('option_count', '-1');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('non-negative');
    });
  });

  describe('the nine Customization bools', () => {
    const CUSTOMIZATION_KEYS = [
      'hidden_files_toggle_enabled',
      'file_filter_toggle_enabled',
      'file_sort_options_enabled',
      'folder_creation_enabled',
      'favorites_enabled',
      'recent_list_enabled',
      'layout_toggle_enabled',
      'overwrite_warning_enabled',
      'deleting_enabled',
    ];

    it.each(CUSTOMIZATION_KEYS)('%s accepts true and false', (key) => {
      expect(check(key, 'true')).toBeNull();
      expect(check(key, 'false')).toBeNull();
    });

    it.each(CUSTOMIZATION_KEYS)('%s rejects a non-boolean', (key) => {
      expect(check(key, 'yes')?.message).toContain('boolean');
    });
  });

  describe('current_dir / current_file / current_path', () => {
    it('register no validator: PROPERTY_USAGE_NONE means they never serialise', () => {
      expect(validatorRegistry.findValidator('FileDialog', 'current_dir')).toBeNull();
      expect(validatorRegistry.findValidator('FileDialog', 'current_file')).toBeNull();
      expect(validatorRegistry.findValidator('FileDialog', 'current_path')).toBeNull();
    });
  });

  describe('inheritance through the base-walk', () => {
    it('resolves an inherited ConfirmationDialog key (cancel_button_text)', () => {
      expect(check('cancel_button_text', '"No thanks"')).toBeNull();
    });

    it('resolves an inherited AcceptDialog key (dialog_autowrap)', () => {
      expect(check('dialog_autowrap', 'true')).toBeNull();
    });

    it('resolves an inherited Window key (mode)', () => {
      expect(check('mode', '0')).toBeNull();
    });
  });
});
