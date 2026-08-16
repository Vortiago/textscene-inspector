/**
 * CanvasLayer's own validators, pinned directly against the registry rather
 * than through a full scene, per `canvas_layer.cpp`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CanvasLayer', property);
  expect(validator, `no validator registered for CanvasLayer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('CanvasLayer validators', () => {
  describe('layer', () => {
    // canvas_layer.cpp:340 — PROPERTY_HINT_RANGE bound to int32 min/max
    // (RS::CANVAS_LAYER_MIN/MAX, rendering_server.h:105-106).
    it('accepts real corpus values (0, 1, 100)', () => {
      expect(check('layer', '0')).toBeNull();
      expect(check('layer', '1')).toBeNull();
      expect(check('layer', '100')).toBeNull();
    });

    it('accepts both int32 extremes', () => {
      expect(check('layer', '2147483647')).toBeNull();
      expect(check('layer', '-2147483648')).toBeNull();
    });

    // set_layer (canvas_layer.cpp:37-43) is a bare assignment, no ERR_FAIL
    // or clamp, so past the hint is a warning, not an error.
    it('warns, not errors, just past either int32 extreme', () => {
      // `2147483648` is the unsigned spelling of the int32 floor, so it lands
      // ON the hint's own minimum rather than outside it.
      const above = check('layer', '4294967296');
      const below = check('layer', '-2147483649');
      // Asserting the VALUE code (not just severity) proves the range branch
      // ran, rather than a format rejection landing on the right severity by
      // coincidence.
      // Both are outside the 32-bit band, so the slot refuses them before the
      // range branch is reached.
      expect(above?.code).toBe('INVALID_LAYER_VALUE');
      expect(above?.severity).toBe('error');
      expect(below?.code).toBe('INVALID_LAYER_VALUE');
      expect(below?.severity).toBe('error');
    });
  });

  describe('visible', () => {
    // canvas_layer.cpp:49-65 — set_visible is a bare assignment (plus an
    // early-return no-op check), no hint on the BOOL property.
    it('accepts true and false', () => {
      expect(check('visible', 'true')).toBeNull();
      expect(check('visible', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('visible', 'sure');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('offset', () => {
    // canvas_layer.cpp:118-125 — set_offset is a bare assignment. Hint is
    // PROPERTY_HINT_NONE with "suffix:px" only (canvas_layer.cpp:343), not a
    // bound, so format-only.
    it('accepts a Vector2', () => {
      expect(check('offset', 'Vector2(10, -5)')).toBeNull();
    });

    it('rejects a malformed literal', () => {
      const error = check('offset', 'Vector2(1)');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('rotation', () => {
    // canvas_layer.cpp:344 — PROPERTY_HINT_RANGE "-1080,1080,0.1,or_less,
    // or_greater,radians_as_degrees": both ends carry their open flag, so
    // neither ever warns (ADR-0032). set_rotation (canvas_layer.cpp:135-142)
    // is a bare assignment, no is_finite guard either.
    it('accepts values far past the hinted degree span, since both ends are open', () => {
      expect(check('rotation', '1000')).toBeNull();
      expect(check('rotation', '-1000')).toBeNull();
    });

    it('accepts inf, -inf and nan — no is_finite guard in the setter', () => {
      expect(check('rotation', 'inf')).toBeNull();
      expect(check('rotation', 'inf_neg')).toBeNull();
      expect(check('rotation', 'nan')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('rotation', 'sideways');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('scale', () => {
    // canvas_layer.cpp:152-159 — set_scale is a bare assignment, no zero
    // guard (unlike Node2D's, which substitutes CMP_EPSILON). Hint is
    // PROPERTY_HINT_LINK (canvas_layer.cpp:345), an inspector display hint
    // pairing the two components, not a bound.
    it('accepts a zero-component scale — no zero guard in the setter', () => {
      expect(check('scale', 'Vector2(0, 0)')).toBeNull();
      expect(check('scale', 'Vector2(0, 1)')).toBeNull();
    });

    it('accepts a negative scale — a mirror/flip is legal', () => {
      expect(check('scale', 'Vector2(-2, -2)')).toBeNull();
    });

    it('rejects a malformed literal', () => {
      const error = check('scale', 'Vector2(1)');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('transform', () => {
    // canvas_layer.cpp:79-85 — set_transform is a bare assignment. Hint is
    // PROPERTY_HINT_NONE with "suffix:px" only (canvas_layer.cpp:346).
    it('accepts a Transform2D', () => {
      expect(check('transform', 'Transform2D(1, 0, 0, 1, 0, 0)')).toBeNull();
    });

    it('rejects a component count other than six', () => {
      expect(check('transform', 'Transform2D(1, 0, 0)')).not.toBeNull();
    });

    it('rejects a value that is not a Transform2D at all', () => {
      expect(check('transform', 'Vector2(1, 2)')).not.toBeNull();
    });
  });

  describe('follow_viewport_enabled', () => {
    // canvas_layer.cpp:273-280 — set_follow_viewport is a bare assignment
    // (plus an equal-check). Hint is PROPERTY_HINT_GROUP_ENABLE
    // (canvas_layer.cpp:350), which only makes the group checkable in the
    // inspector and carries no bound for a BOOL.
    it('accepts true and false', () => {
      expect(check('follow_viewport_enabled', 'true')).toBeNull();
      expect(check('follow_viewport_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('follow_viewport_enabled', 'sure');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('follow_viewport_scale', () => {
    // canvas_layer.cpp:351 — PROPERTY_HINT_RANGE "0.001,1000,0.001,
    // or_greater,or_less": both ends open, same shape as `rotation`, so no
    // bound applies. set_follow_viewport_scale (canvas_layer.cpp:286-289) is
    // a bare assignment.
    it('accepts values far past the hinted span, since both ends are open', () => {
      expect(check('follow_viewport_scale', '0')).toBeNull();
      expect(check('follow_viewport_scale', '-5')).toBeNull();
      expect(check('follow_viewport_scale', '5000')).toBeNull();
    });

    it('accepts inf, -inf and nan — no is_finite guard in the setter', () => {
      expect(check('follow_viewport_scale', 'inf')).toBeNull();
      expect(check('follow_viewport_scale', 'inf_neg')).toBeNull();
      expect(check('follow_viewport_scale', 'nan')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('follow_viewport_scale', 'big');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });
});
