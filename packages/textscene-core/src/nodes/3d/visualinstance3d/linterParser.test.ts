/**
 * VisualInstance3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry`, not through `Linter`: Linter pulls
 * `linter/index.ts`, the barrel that imports every slice, so a scoped run while
 * sibling slices are being written fails on their half-finished files. The
 * barrel path is covered by the full suite.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('VisualInstance3D', property);
  expect(validator, `no validator registered for VisualInstance3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('VisualInstance3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('VisualInstance3D')).not.toEqual([]);
  });

  describe('layers', () => {
    it('accepts the documented default (1)', () => {
      expect(check('layers', '1')).toBeNull();
    });

    it('accepts a combined bitmask (layers 1 and 2)', () => {
      expect(check('layers', '3')).toBeNull();
    });

    it('accepts 0 (no layers set)', () => {
      // layerBitmask.ts: 0 is legal everywhere — "no layers" is a valid state.
      expect(check('layers', '0')).toBeNull();
    });

    it('accepts the maximum 32-bit mask (2^32 - 1)', () => {
      expect(check('layers', '4294967295')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('layers', 'not-a-number')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('layers', '-1')).not.toBeNull();
    });

    it('rejects a value beyond the 32-bit mask', () => {
      expect(check('layers', '4294967296')).not.toBeNull();
    });
  });
});
