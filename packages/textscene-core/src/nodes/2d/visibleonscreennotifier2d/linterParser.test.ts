/**
 * VisibleOnScreenNotifier2D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('VisibleOnScreenNotifier2D', property);
  expect(validator, `no validator registered for VisibleOnScreenNotifier2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('VisibleOnScreenNotifier2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('VisibleOnScreenNotifier2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('VisibleOnScreenNotifier2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('rect', () => {
    it('accepts the documented default (Rect2(-10, -10, 20, 20))', () => {
      expect(check('rect', 'Rect2(-10, -10, 20, 20)')).toBeNull();
    });

    it('accepts a Rect2(x, y, w, h) literal', () => {
      expect(check('rect', 'Rect2(0, 0, 100, 100)')).toBeNull();
    });

    it('rejects a Vector2 (wrong arity)', () => {
      expect(check('rect', 'Vector2(1, 1)')).not.toBeNull();
    });
  });

  describe('show_rect', () => {
    it('accepts true and false', () => {
      expect(check('show_rect', 'true')).toBeNull();
      expect(check('show_rect', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('show_rect', '1')).not.toBeNull();
    });
  });
});
