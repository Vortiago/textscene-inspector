/**
 * Tests the TextureProgressBar strict validators through `validatorRegistry`, so a failure points
 * at the validator. No `linter.ts`: `_validate_property` (texture_progress_bar.cpp:638-649) is
 * editor-only, and texture_progress_bar.cpp/.h emit no `WARN_PRINT` or configuration warning.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

const OWN_KEYS = [
  'fill_mode',
  'nine_patch_stretch',
  'radial_center_offset',
  'radial_fill_degrees',
  'radial_initial_angle',
  'stretch_margin_bottom',
  'stretch_margin_left',
  'stretch_margin_right',
  'stretch_margin_top',
  'texture_over',
  'texture_progress',
  'texture_progress_offset',
  'texture_under',
  'tint_over',
  'tint_progress',
  'tint_under',
];

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TextureProgressBar', property);
  expect(validator, `no validator registered for TextureProgressBar.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('TextureProgressBar strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('TextureProgressBar')).not.toEqual([]);
  });

  it('registers exactly its sixteen own members', () => {
    expect(validatorRegistry.getOwnKeys('TextureProgressBar').sort()).toEqual([...OWN_KEYS].sort());
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format.
    const accepted = validatorRegistry
      .getOwnKeys('TextureProgressBar')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('does not re-register mouse_filter — it carries overrides="Control" in the XML', () => {
    expect(validatorRegistry.getOwnKeys('TextureProgressBar')).not.toContain('mouse_filter');
  });

  it('does not re-register size_flags_vertical — it carries overrides="Control" in the XML', () => {
    expect(validatorRegistry.getOwnKeys('TextureProgressBar')).not.toContain('size_flags_vertical');
  });

  it('does not re-register step — it carries overrides="Range" in the XML', () => {
    expect(validatorRegistry.getOwnKeys('TextureProgressBar')).not.toContain('step');
  });

  describe('base-walk to ancestors', () => {
    it('resolves min_value and max_value from Range', () => {
      expect(validatorRegistry.findValidator('TextureProgressBar', 'min_value')).not.toBeNull();
      expect(validatorRegistry.findValidator('TextureProgressBar', 'max_value')).not.toBeNull();
    });

    it('resolves anchor_right from Control', () => {
      expect(validatorRegistry.findValidator('TextureProgressBar', 'anchor_right')).not.toBeNull();
    });

    it('resolves modulate from CanvasItem', () => {
      expect(validatorRegistry.findValidator('TextureProgressBar', 'modulate')).not.toBeNull();
    });
  });

  // texture_progress_bar.cpp:576: set_fill_mode: `ERR_FAIL_INDEX(p_fill, FILL_MODE_MAX)`
  describe('fill_mode', () => {
    it('accepts 0, FILL_LEFT_TO_RIGHT', () => {
      expect(check('fill_mode', '0')).toBeNull();
    });

    it('accepts 8, FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE, the top of the enum', () => {
      expect(check('fill_mode', '8')).toBeNull();
    });

    it('accepts 4, FILL_CLOCKWISE, a radial mode', () => {
      expect(check('fill_mode', '4')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('fill_mode', 'clockwise')).not.toBeNull();
    });

    it('rejects 9 as an error — the setter refuses the write outright', () => {
      const err = check('fill_mode', '9');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });

    it('rejects -1 as an error', () => {
      const err = check('fill_mode', '-1');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
  });

  // texture_progress_bar.cpp:66-75: set_nine_patch_stretch assigns straight through
  describe('nine_patch_stretch', () => {
    it('accepts true', () => {
      expect(check('nine_patch_stretch', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('nine_patch_stretch', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('nine_patch_stretch', '1')).not.toBeNull();
    });
  });

  // texture_progress_bar.cpp:625-632: set_radial_center_offset assigns straight through
  describe('radial_center_offset', () => {
    it('accepts a typical Vector2', () => {
      expect(check('radial_center_offset', 'Vector2(0, 0)')).toBeNull();
    });

    it('accepts a Vector2 outside the texture bounds — the engine clamps the effective centre, not the property', () => {
      expect(check('radial_center_offset', 'Vector2(-500, 900)')).toBeNull();
    });

    it('rejects a malformed Vector2', () => {
      expect(check('radial_center_offset', '(0, 0)')).not.toBeNull();
    });
  });

  // texture_progress_bar.cpp:610-619: set_fill_degrees: `CLAMP(p_angle, 0, 360)`
  describe('radial_fill_degrees', () => {
    it('accepts the default, 360', () => {
      expect(check('radial_fill_degrees', '360')).toBeNull();
    });

    it('accepts 0, the bottom of the clamp', () => {
      expect(check('radial_fill_degrees', '0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('radial_fill_degrees', 'wide')).not.toBeNull();
    });

    it('rejects 400 as an error — CLAMP alters rather than merely hints the bound', () => {
      const err = check('radial_fill_degrees', '400');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });

    it('rejects -10 as an error', () => {
      const err = check('radial_fill_degrees', '-10');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
  });

  // texture_progress_bar.cpp:591-604: set_radial_initial_angle wraps with Math::fposmodp
  describe('radial_initial_angle', () => {
    it('accepts the default, 0', () => {
      expect(check('radial_initial_angle', '0')).toBeNull();
    });

    it('accepts 360, the closed top of the range', () => {
      expect(check('radial_initial_angle', '360')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('radial_initial_angle', 'north')).not.toBeNull();
    });

    it('rejects 400 as an error — fposmodp wraps rather than merely hints the bound', () => {
      const err = check('radial_initial_angle', '400');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });

    it('rejects -10 as an error', () => {
      const err = check('radial_initial_angle', '-10');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('error');
    });
  });

  // texture_progress_bar.cpp:700-703: ADD_PROPERTYI hints "0,16384,1,suffix:px" on each side
  describe.each([
    ['stretch_margin_bottom', 703],
    ['stretch_margin_left', 700],
    ['stretch_margin_right', 702],
    ['stretch_margin_top', 701],
  ])('%s (texture_progress_bar.cpp:%d)', (property, _line) => {
    it('accepts 0, the default', () => {
      expect(check(property, '0')).toBeNull();
    });

    it('accepts 16384, the top of the hint', () => {
      expect(check(property, '16384')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check(property, 'wide')).not.toBeNull();
    });

    it('warns above 16384 — only the hint states the ceiling, set_stretch_margin assigns straight through', () => {
      const err = check(property, '20000');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });

    it('warns below 0 — only the hint states the floor', () => {
      const err = check(property, '-5');
      expect(err).not.toBeNull();
      expect(err!.severity).toBe('warning');
    });
  });

  // texture_progress_bar.cpp:41-47, 99-105, 33-39: all three delegate to _set_texture
  describe.each(['texture_over', 'texture_progress', 'texture_under'])('%s', (property) => {
    it('accepts a SubResource reference', () => {
      expect(check(property, 'SubResource("Texture2D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check(property, 'ExtResource("1_abcd")')).toBeNull();
    });

    it('rejects a bare string', () => {
      expect(check(property, '"res://icon.png"')).not.toBeNull();
    });
  });

  // texture_progress_bar.cpp:107-114: set_progress_offset (texture_progress_offset) assigns straight through
  describe('texture_progress_offset', () => {
    it('accepts a typical Vector2', () => {
      expect(check('texture_progress_offset', 'Vector2(4, -2)')).toBeNull();
    });

    it('rejects a malformed Vector2', () => {
      expect(check('texture_progress_offset', '4, -2')).not.toBeNull();
    });
  });

  // texture_progress_bar.cpp:120-157: set_tint_under/set_tint_progress/set_tint_over assign straight through
  describe.each(['tint_over', 'tint_progress', 'tint_under'])('%s', (property) => {
    it('accepts the default opaque white', () => {
      expect(check(property, 'Color(1, 1, 1, 1)')).toBeNull();
    });

    it('accepts a translucent tint', () => {
      expect(check(property, 'Color(0.8, 0.6, 0.2, 0.5)')).toBeNull();
    });

    it('rejects a Color missing a component', () => {
      expect(check(property, 'Color(1, 1, 1)')).not.toBeNull();
    });
  });

  describe('the fixture, unit-texture-progress-bar.tscn', () => {
    // Every literal MyTextureProgressBar carries, verbatim from the .tscn, proves the
    // fixture's "zero errors and zero warnings" beyond the boundary cases above.
    const FIXTURE_VALUES: Record<string, string> = {
      fill_mode: '4',
      nine_patch_stretch: 'true',
      radial_center_offset: 'Vector2(2, 3)',
      radial_fill_degrees: '270.0',
      radial_initial_angle: '45.0',
      stretch_margin_bottom: '4',
      stretch_margin_left: '4',
      stretch_margin_right: '4',
      stretch_margin_top: '4',
      texture_over: 'SubResource("PlaceholderTexture2D_over")',
      texture_progress: 'SubResource("PlaceholderTexture2D_progress")',
      texture_progress_offset: 'Vector2(1, 1)',
      texture_under: 'SubResource("PlaceholderTexture2D_under")',
      tint_over: 'Color(1, 0.8, 0.8, 1)',
      tint_progress: 'Color(0.8, 1, 0.8, 1)',
      tint_under: 'Color(0.8, 0.8, 1, 1)',
    };

    it('exercises every own key the fixture is meant to cover', () => {
      expect(Object.keys(FIXTURE_VALUES).sort()).toEqual([...OWN_KEYS].sort());
    });

    it.each(Object.entries(FIXTURE_VALUES))('%s accepts its fixture literal %s', (property, value) => {
      expect(check(property, value)).toBeNull();
    });
  });
});
