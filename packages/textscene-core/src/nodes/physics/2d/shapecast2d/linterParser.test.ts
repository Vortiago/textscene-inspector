/**
 * ShapeCast2D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ShapeCast2D', property);
  expect(validator, `no validator registered for ShapeCast2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ShapeCast2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('ShapeCast2D')).not.toEqual([]);
  });

  it('does not register a validator for the read-only collision_result', () => {
    expect(validatorRegistry.findValidator('ShapeCast2D', 'collision_result')).toBeNull();
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('ShapeCast2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('boolean flags', () => {
    const booleanProps = ['enabled', 'exclude_parent', 'collide_with_areas', 'collide_with_bodies'];

    it.each(booleanProps)('accepts "true" and "false" for %s', (property) => {
      expect(check(property, 'true')).toBeNull();
      expect(check(property, 'false')).toBeNull();
    });

    it.each(booleanProps)('rejects a non-boolean value for %s', (property) => {
      const error = check(property, 'yes');
      expect(error).not.toBeNull();
      expect(error!.code).toBe(`INVALID_${property.toUpperCase()}_FORMAT`);
    });
  });

  describe('shape', () => {
    // scene/2d/physics/shape_cast_2d.cpp:469 — PROPERTY_HINT_RESOURCE_TYPE, "Shape2D"
    it('accepts a SubResource reference', () => {
      expect(check('shape', 'SubResource("CircleShape2D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('shape', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a value that is not a resource reference', () => {
      const error = check('shape', 'CircleShape2D_1');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_SHAPE_REFERENCE');
    });
  });

  describe('target_position', () => {
    // scene/2d/physics/shape_cast_2d.cpp:471 — PROPERTY_HINT_NONE, "suffix:px" (unit hint only, no range)
    it('accepts a Vector2 literal', () => {
      expect(check('target_position', 'Vector2(0, 50)')).toBeNull();
    });

    it('accepts negative and fractional components', () => {
      expect(check('target_position', 'Vector2(-12.5, 0.25)')).toBeNull();
    });

    it('rejects a value that is not a Vector2 literal', () => {
      const error = check('target_position', '50');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_TARGET_POSITION_FORMAT');
    });
  });

  describe('margin', () => {
    // scene/2d/physics/shape_cast_2d.cpp:472 — PROPERTY_HINT_RANGE, "0,100,0.01,suffix:px"
    it('accepts the minimum bound', () => {
      expect(check('margin', '0')).toBeNull();
    });

    it('accepts the maximum bound', () => {
      expect(check('margin', '100')).toBeNull();
    });

    it('accepts a fractional value inside the range', () => {
      expect(check('margin', '3.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('margin', 'wide');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_MARGIN_FORMAT');
    });

    it('rejects a negative value', () => {
      const error = check('margin', '-0.01');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_MARGIN_VALUE');
    });

    it('rejects a value beyond the 100 cap (no or_greater on this hint)', () => {
      const error = check('margin', '100.01');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_MARGIN_VALUE');
    });
  });

  describe('max_results', () => {
    // scene/2d/physics/shape_cast_2d.cpp:473 — plain INT, no PROPERTY_HINT_RANGE
    it('accepts the documented default', () => {
      expect(check('max_results', '32')).toBeNull();
    });

    it('accepts zero', () => {
      expect(check('max_results', '0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('max_results', 'many');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_MAX_RESULTS_FORMAT');
    });
  });

  describe('collision_mask', () => {
    // scene/2d/physics/shape_cast_2d.cpp:474 — PROPERTY_HINT_LAYERS_2D_PHYSICS
    it('accepts a single-layer mask', () => {
      expect(check('collision_mask', '1')).toBeNull();
    });

    it('accepts zero (no layers)', () => {
      expect(check('collision_mask', '0')).toBeNull();
    });

    it('accepts the full 32-bit mask', () => {
      expect(check('collision_mask', '4294967295')).toBeNull();
    });

    it('rejects a non-numeric mask', () => {
      const error = check('collision_mask', 'not-a-number');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_MASK_FORMAT');
    });

    it('rejects a negative mask', () => {
      const error = check('collision_mask', '-1');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_MASK_VALUE');
    });

    it('rejects a mask beyond the 32-bit range', () => {
      const error = check('collision_mask', '4294967296');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_MASK_VALUE');
    });
  });
});
