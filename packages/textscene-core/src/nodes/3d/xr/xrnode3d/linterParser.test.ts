/**
 * XRNode3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour is tested through `Linter` in linter.test.ts.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('XRNode3D', property);
  expect(validator, `no validator registered for XRNode3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('XRNode3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('XRNode3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('XRNode3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('pose', () => {
    it('accepts the default as StringName (&"default") or a plain quoted string', () => {
      expect(check('pose', '&"default"')).toBeNull();
      expect(check('pose', '"default"')).toBeNull();
    });

    it('accepts another suggested pose name like &"aim"', () => {
      expect(check('pose', '&"aim"')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      const error = check('pose', 'default');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('pose');
    });
  });

  describe('tracker', () => {
    it('accepts the default empty StringName (&"") or a plain empty quoted string', () => {
      expect(check('tracker', '&""')).toBeNull();
      expect(check('tracker', '""')).toBeNull();
    });

    it('accepts a standard tracker name like &"left_hand"', () => {
      expect(check('tracker', '&"left_hand"')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      const error = check('tracker', 'left_hand');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('tracker');
    });

    it('rejects a value missing its opening quote', () => {
      const error = check('tracker', 'left_hand"');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('tracker');
    });
  });

  describe('show_when_tracked', () => {
    it('accepts true', () => {
      expect(check('show_when_tracked', 'true')).toBeNull();
    });

    it('accepts the default false', () => {
      expect(check('show_when_tracked', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('show_when_tracked', 'maybe');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('show_when_tracked');
    });
  });
});
