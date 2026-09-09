/**
 * ProgressBar strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('ProgressBar', property);
  expect(validator, `no validator registered for ProgressBar.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ProgressBar strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('ProgressBar')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('ProgressBar')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // progress_bar.cpp:200 — set_fill_mode: ERR_FAIL_INDEX(p_fill, FILL_MODE_MAX)
  // refuses the write, so out-of-range is an error.
  describe('fill_mode', () => {
    it('accepts every member of the enum', () => {
      expect(check('fill_mode', '0')).toBeNull();
      expect(check('fill_mode', '1')).toBeNull();
      expect(check('fill_mode', '2')).toBeNull();
      expect(check('fill_mode', '3')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('fill_mode', 'begin')).not.toBeNull();
    });

    it('rejects 4 — FILL_MODE_MAX, refused by ERR_FAIL_INDEX(p_fill, FILL_MODE_MAX)', () => {
      const error = check('fill_mode', '4');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });

    it('rejects a negative index — ERR_FAIL_INDEX has no open floor', () => {
      const error = check('fill_mode', '-1');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });
  });

  // progress_bar.cpp:210-217 — set_show_percentage assigns straight through.
  describe('show_percentage', () => {
    it('accepts true', () => {
      expect(check('show_percentage', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('show_percentage', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('show_percentage', '1')).not.toBeNull();
    });
  });

  // progress_bar.cpp:223-236 — set_indeterminate assigns straight through.
  describe('indeterminate', () => {
    it('accepts true', () => {
      expect(check('indeterminate', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('indeterminate', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('indeterminate', 'yes')).not.toBeNull();
    });
  });

  // progress_bar.cpp:242-253 — set_editor_preview_indeterminate assigns
  // straight through.
  describe('editor_preview_indeterminate', () => {
    it('accepts true', () => {
      expect(check('editor_preview_indeterminate', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('editor_preview_indeterminate', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('editor_preview_indeterminate', 'maybe')).not.toBeNull();
    });
  });

  describe('base-walk resolution', () => {
    it('resolves min_value and max_value from Range without redeclaring them', () => {
      expect(validatorRegistry.findValidator('ProgressBar', 'min_value')).not.toBeNull();
      expect(validatorRegistry.findValidator('ProgressBar', 'max_value')).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('ProgressBar')).not.toContain('min_value');
      expect(validatorRegistry.getOwnKeys('ProgressBar')).not.toContain('max_value');
    });

    it('resolves anchor_right from Control without redeclaring it', () => {
      expect(validatorRegistry.findValidator('ProgressBar', 'anchor_right')).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('ProgressBar')).not.toContain('anchor_right');
    });

    it('resolves modulate from CanvasItem without redeclaring it', () => {
      expect(validatorRegistry.findValidator('ProgressBar', 'modulate')).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('ProgressBar')).not.toContain('modulate');
    });
  });
});
