/**
 * CharacterBody2D strict validators: slide_on_ceiling, up_direction and the
 * two `radians_as_degrees` angles. Asserted through validatorRegistry rather than a
 * full scene lint: the unit under test is the validator, not scene parsing.
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
      expect(check('slide_on_ceiling', '1')?.severity).toBe('warning');
    });
  });

  // character_body_2d.cpp:648, ERR_FAIL_COND_MSG(p_up_direction == Vector2()). Exact equality, so
  // only the zero vector itself is refused; everything else is normalised.
  describe('up_direction', () => {
    it('accepts the default and any other direction', () => {
      expect(check('up_direction', 'Vector2(0, -1)')).toBeNull();
      expect(check('up_direction', 'Vector2(-3, 4)')).toBeNull();
    });

    it('accepts a component under CMP_EPSILON, which this guard does not use', () => {
      expect(check('up_direction', 'Vector2(1e-9, 0)')).toBeNull();
    });

    it.each(['Vector2(nan, 0)', 'Vector2(inf, 0)'])('accepts %s, unequal to zero', (value) => {
      expect(check('up_direction', value)).toBeNull();
    });

    it('errors on the zero vector the setter refuses', () => {
      const error = check('up_direction', 'Vector2(0, 0)');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('zero vector');
    });

    it('errors on the Vector2i spelling of it that Godot converts', () => {
      expect(check('up_direction', 'Vector2i(0, 0)')?.severity).toBe('error');
    });

    it('still reports a malformed literal as a format error', () => {
      expect(check('up_direction', 'Vector2(0)')?.message).toContain('Vector2 with 2 numbers');
    });
  });

  // character_body_2d.cpp:748 and :742, both PROPERTY_HINT_RANGE
  // "0,180,0.1,radians_as_degrees": the inspector shows 0-180 DEGREES while the
  // .tscn stores RADIANS, so the ceiling is PI and the floor is 0.
  describe.each(['floor_max_angle', 'wall_min_slide_angle'])('%s', (property) => {
    it('accepts the converted ends Godot itself writes', () => {
      expect(check(property, '0')).toBeNull();
      expect(check(property, '3.1415927')).toBeNull();
    });

    it('accepts a zero-degree float32 round-trip that lands just under the floor', () => {
      // Godot stores the angle as float32 and writes it back in decimal, so a
      // value the editor set to 0 degrees reloads a hair negative. A floor at
      // exactly 0 is one epsilon tighter than the hint permits.
      expect(check(property, '-0.00005')).toBeNull();
    });

    it('warns past the epsilon, since the setter assigns straight through', () => {
      // set_floor_max_angle (:622-624) and set_wall_min_slide_angle (:639-641).
      expect(check(property, '-0.01')?.severity).toBe('warning');
      expect(check(property, '3.2')?.severity).toBe('warning');
    });
  });
});
