/**
 * CharacterBody2D strict validators: slide_on_ceiling. Asserted through
 * validatorRegistry rather than a full scene lint: the unit under test is
 * the validator, not scene parsing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CharacterBody2D', property);
  expect(validator, `no validator registered for CharacterBody2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('CharacterBody2D strict validators (physics state)', () => {
  describe('slide_on_ceiling', () => {
    it.each(['true', 'false'])('accepts %s', (value) => {
      expect(check('slide_on_ceiling', value)).toBeNull();
    });

    it('rejects a numeric stand-in for a boolean', () => {
      expect(check('slide_on_ceiling', '1')?.severity).toBe('error');
    });
  });
});
