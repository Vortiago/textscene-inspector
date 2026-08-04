/**
 * FoldableContainer strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('FoldableContainer', property);
  expect(validator, `no validator registered for FoldableContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('FoldableContainer strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('FoldableContainer')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('FoldableContainer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('folded', () => {
    it('accepts true and false', () => {
      expect(check('folded', 'true')).toBeNull();
      expect(check('folded', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('folded', '1')).not.toBeNull();
    });
  });

  describe('title', () => {
    it('accepts a quoted string', () => {
      expect(check('title', '"Inventory"')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('title', 'Inventory')).not.toBeNull();
    });

    it('rejects trailing junk after the closing quote', () => {
      expect(check('title', '"Head" junk "Tail"')).not.toBeNull();
    });
  });

  describe('title_alignment', () => {
    it('accepts the three enforced values', () => {
      expect(check('title_alignment', '0')).toBeNull();
      expect(check('title_alignment', '1')).toBeNull();
      expect(check('title_alignment', '2')).toBeNull();
    });

    it('errors above the enforced range (ERR_FAIL_INDEX rejects FILL=3)', () => {
      const result = check('title_alignment', '3');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('errors below the enforced range', () => {
      const result = check('title_alignment', '-1');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('title_position', () => {
    it('accepts Top and Bottom', () => {
      expect(check('title_position', '0')).toBeNull();
      expect(check('title_position', '1')).toBeNull();
    });

    it('errors at POSITION_MAX', () => {
      const result = check('title_position', '2');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('title_text_overrun_behavior', () => {
    it('accepts every hinted entry', () => {
      for (const value of ['0', '1', '2', '3', '4']) {
        expect(check('title_text_overrun_behavior', value)).toBeNull();
      }
    });

    it('warns beyond the hint, since the setter never ERR_FAILs', () => {
      const result = check('title_text_overrun_behavior', '5');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });
  });

  describe('foldable_group', () => {
    it('accepts a SubResource reference', () => {
      expect(check('foldable_group', 'SubResource("FoldableGroup_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('foldable_group', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a non-reference value', () => {
      expect(check('foldable_group', '"FoldableGroup_1"')).not.toBeNull();
    });
  });

  describe('title_text_direction', () => {
    it('accepts all four enforced values', () => {
      for (const value of ['0', '1', '2', '3']) {
        expect(check('title_text_direction', value)).toBeNull();
      }
    });

    it('errors at -1, unlike Button which special-cases it as legal', () => {
      const result = check('title_text_direction', '-1');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('errors above the enforced range', () => {
      const result = check('title_text_direction', '4');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('language', () => {
    it('accepts a quoted locale string', () => {
      expect(check('language', '"en"')).toBeNull();
    });

    it('accepts the empty quoted default', () => {
      expect(check('language', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('language', 'en')).not.toBeNull();
    });

    it('rejects trailing junk after the closing quote', () => {
      expect(check('language', '"en" junk "fr"')).not.toBeNull();
    });
  });

  it('inherits Control\'s layout set through the base-walk', () => {
    expect(validatorRegistry.findValidator('FoldableContainer', 'anchor_right')).not.toBeNull();
  });

  it('inherits CanvasItem\'s modulate through the base-walk', () => {
    expect(validatorRegistry.findValidator('FoldableContainer', 'modulate')).not.toBeNull();
  });
});
