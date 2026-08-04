/**
 * GraphFrame strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property (happy, malformed, and any bound) and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GraphFrame', property);
  expect(validator, `no validator registered for GraphFrame.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GraphFrame strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GraphFrame')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('GraphFrame')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('title', () => {
    it('accepts a quoted title', () => {
      expect(check('title', '"My Frame"')).toBeNull();
    });

    it('accepts the empty title Godot defaults to', () => {
      expect(check('title', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('title', 'My Frame')?.message).toContain('quoted');
    });
  });

  describe('autoshrink_enabled', () => {
    it('accepts true', () => {
      expect(check('autoshrink_enabled', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('autoshrink_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('autoshrink_enabled', 'yes')?.message).toContain('boolean');
    });
  });

  describe('autoshrink_margin', () => {
    it('accepts the default of 40', () => {
      expect(check('autoshrink_margin', '40')).toBeNull();
    });

    it('accepts the bottom of the hint, 0', () => {
      expect(check('autoshrink_margin', '0')).toBeNull();
    });

    it('accepts the top of the hint, 128', () => {
      expect(check('autoshrink_margin', '128')).toBeNull();
    });

    it('warns, not errors, above 128: set_autoshrink_margin assigns straight through', () => {
      const found = check('autoshrink_margin', '129');
      expect(found?.severity).toBe('warning');
    });

    it('warns, not errors, below 0', () => {
      const found = check('autoshrink_margin', '-1');
      expect(found?.severity).toBe('warning');
    });

    it('rejects a non-numeric value as a format error', () => {
      const found = check('autoshrink_margin', 'abc');
      expect(found?.severity).toBe('error');
    });
  });

  describe('drag_margin', () => {
    it('accepts the default of 16', () => {
      expect(check('drag_margin', '16')).toBeNull();
    });

    it('accepts the bottom of the hint, 0', () => {
      expect(check('drag_margin', '0')).toBeNull();
    });

    it('accepts the top of the hint, 128', () => {
      expect(check('drag_margin', '128')).toBeNull();
    });

    it('warns, not errors, above 128: set_drag_margin assigns straight through', () => {
      const found = check('drag_margin', '129');
      expect(found?.severity).toBe('warning');
    });

    it('warns, not errors, below 0', () => {
      const found = check('drag_margin', '-1');
      expect(found?.severity).toBe('warning');
    });
  });

  describe('tint_color_enabled', () => {
    it('accepts true', () => {
      expect(check('tint_color_enabled', 'true')).toBeNull();
    });

    it('accepts false, the default', () => {
      expect(check('tint_color_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('tint_color_enabled', 'maybe')?.message).toContain('boolean');
    });
  });

  describe('tint_color', () => {
    it('accepts the default Color(0.3, 0.3, 0.3, 0.75)', () => {
      expect(check('tint_color', 'Color(0.3, 0.3, 0.3, 0.75)')).toBeNull();
    });

    it('accepts fully transparent black: no bound on any component', () => {
      expect(check('tint_color', 'Color(0, 0, 0, 0)')).toBeNull();
    });

    it('rejects a Color literal missing a component', () => {
      expect(check('tint_color', 'Color(1, 1)')?.message).toContain('Color');
    });
  });

  it('does not register mouse_filter: GraphFrame only overrides Control\'s default, it does not own the property', () => {
    expect(validatorRegistry.getOwnKeys('GraphFrame')).not.toContain('mouse_filter');
  });

  it('resolves anchor_right from Control through the base-walk', () => {
    const validator = validatorRegistry.findValidator('GraphFrame', 'anchor_right');
    expect(validator).not.toBeNull();
    expect(validator!('anchor_right', '1.0', 1)).toBeNull();
  });

  it('resolves modulate from CanvasItem through the base-walk', () => {
    const validator = validatorRegistry.findValidator('GraphFrame', 'modulate');
    expect(validator).not.toBeNull();
    expect(validator!('modulate', 'Color(1, 1, 1, 1)', 1)).toBeNull();
  });

  it('resolves resizable from GraphElement through the base-walk', () => {
    const validator = validatorRegistry.findValidator('GraphFrame', 'resizable');
    expect(validator).not.toBeNull();
    expect(validator!('resizable', 'true', 1)).toBeNull();
  });
});
