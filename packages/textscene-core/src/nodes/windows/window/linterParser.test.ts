/**
 * Window strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Window', property);
  expect(validator, `no validator registered for Window.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Window strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('Window')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases below cover the rest.
    const accepted = validatorRegistry
      .getOwnKeys('Window')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('identity and placement (mode, title, initial_position, position, size)', () => {
    it('accepts every mode value 0-4', () => {
      for (const value of ['0', '1', '2', '3', '4']) {
        expect(check('mode', value)).toBeNull();
      }
    });

    it('rejects a mode outside 0-4', () => {
      expect(check('mode', '5')?.message).toContain('0-4');
    });

    it('accepts a quoted title', () => {
      expect(check('title', '"My Window"')).toBeNull();
    });

    it('rejects an unquoted title', () => {
      expect(check('title', 'My Window')?.message).toContain('quoted');
    });

    it('accepts every initial_position value 0-5', () => {
      for (const value of ['0', '1', '2', '3', '4', '5']) {
        expect(check('initial_position', value)).toBeNull();
      }
    });

    it('rejects an initial_position outside 0-5', () => {
      expect(check('initial_position', '6')?.message).toContain('0-5');
    });

    it('accepts a negative position (off-screen / secondary monitor)', () => {
      expect(check('position', 'Vector2i(-100, -50)')).toBeNull();
    });

    it('rejects a malformed position', () => {
      expect(check('position', 'Vector2i(1, 2, 3)')).not.toBeNull();
    });

    it('accepts a non-negative size', () => {
      expect(check('size', 'Vector2i(800, 600)')).toBeNull();
    });

    it('rejects a negative size', () => {
      expect(check('size', 'Vector2i(-1, 600)')).not.toBeNull();
    });
  });

  describe('screen, decoration area, and passthrough (current_screen, nonclient_area, mouse_passthrough_polygon)', () => {
    it('accepts current_screen 0 and above (soft or_greater bound has no cap)', () => {
      expect(check('current_screen', '0')).toBeNull();
      expect(check('current_screen', '100')).toBeNull();
    });

    it('rejects a negative current_screen', () => {
      expect(check('current_screen', '-1')?.message).toContain('non-negative');
    });

    it('accepts a Rect2i nonclient_area', () => {
      expect(check('nonclient_area', 'Rect2i(0, 0, 200, 32)')).toBeNull();
    });

    it('rejects a malformed nonclient_area', () => {
      expect(check('nonclient_area', 'Rect2i(0, 0, 200)')?.message).toContain('Rect2i');
    });

    it('accepts an empty mouse_passthrough_polygon', () => {
      expect(check('mouse_passthrough_polygon', 'PackedVector2Array()')).toBeNull();
    });

    it('accepts a populated mouse_passthrough_polygon', () => {
      expect(check('mouse_passthrough_polygon', 'PackedVector2Array(0, 0, 10, 0, 10, 10)')).toBeNull();
    });

    it('rejects an odd-length mouse_passthrough_polygon (truncated vertex)', () => {
      expect(check('mouse_passthrough_polygon', 'PackedVector2Array(0, 0, 10)')).not.toBeNull();
    });
  });

  describe('flags (all boolean)', () => {
    const flags = [
      'visible',
      'wrap_controls',
      'transient',
      'transient_to_focused',
      'exclusive',
      'unresizable',
      'borderless',
      'always_on_top',
      'transparent',
      'unfocusable',
      'popup_window',
      'extend_to_title',
      'mouse_passthrough',
      'sharp_corners',
      'exclude_from_capture',
      'popup_wm_hint',
      'minimize_disabled',
      'maximize_disabled',
      'force_native',
    ];

    it('accepts true and false on every flag', () => {
      for (const flag of flags) {
        expect(check(flag, 'true')).toBeNull();
        expect(check(flag, 'false')).toBeNull();
      }
    });

    it('rejects a non-boolean on every flag', () => {
      for (const flag of flags) {
        expect(check(flag, 'yes')?.message).toContain('boolean');
      }
    });
  });

  describe('limits (min_size, max_size, keep_title_visible)', () => {
    it('accepts non-negative min_size and max_size', () => {
      expect(check('min_size', 'Vector2i(320, 240)')).toBeNull();
      expect(check('max_size', 'Vector2i(1920, 1080)')).toBeNull();
    });

    it('rejects a negative min_size or max_size', () => {
      expect(check('min_size', 'Vector2i(-1, 0)')).not.toBeNull();
      expect(check('max_size', 'Vector2i(0, -1)')).not.toBeNull();
    });

    it('accepts keep_title_visible booleans', () => {
      expect(check('keep_title_visible', 'true')).toBeNull();
      expect(check('keep_title_visible', 'false')).toBeNull();
    });
  });

  describe('content scale', () => {
    it('accepts a non-negative content_scale_size', () => {
      expect(check('content_scale_size', 'Vector2i(1280, 720)')).toBeNull();
    });

    it('rejects a negative content_scale_size', () => {
      // Assert the diagnostic itself: `?.message` is `undefined` when the
      // validator wrongly accepts, and `expect(undefined).not.toBeNull()`
      // passes — the test could never fail.
      expect(check('content_scale_size', 'Vector2i(-1, 720)')).not.toBeNull();
    });

    it('accepts every content_scale_mode value 0-2', () => {
      for (const value of ['0', '1', '2']) {
        expect(check('content_scale_mode', value)).toBeNull();
      }
    });

    it('rejects a content_scale_mode outside 0-2', () => {
      expect(check('content_scale_mode', '3')?.message).toContain('0-2');
    });

    it('accepts every content_scale_aspect value 0-4', () => {
      for (const value of ['0', '1', '2', '3', '4']) {
        expect(check('content_scale_aspect', value)).toBeNull();
      }
    });

    it('rejects a content_scale_aspect outside 0-4', () => {
      expect(check('content_scale_aspect', '5')?.message).toContain('0-4');
    });

    it('accepts every content_scale_stretch value 0-1', () => {
      expect(check('content_scale_stretch', '0')).toBeNull();
      expect(check('content_scale_stretch', '1')).toBeNull();
    });

    it('rejects a content_scale_stretch outside 0-1', () => {
      expect(check('content_scale_stretch', '2')?.message).toContain('0-1');
    });

    it('accepts content_scale_factor inside the hint, and below its floor too', () => {
      // The hint's 0.5 floor is not enforced by anything: 0.1 loads and runs,
      // so it is not diagnosed at all.
      expect(check('content_scale_factor', '0.5')).toBeNull();
      expect(check('content_scale_factor', '8.0')).toBeNull();
      expect(check('content_scale_factor', '0.1')).toBeNull();
    });

    it('warns above the hinted 8.0 ceiling rather than erroring', () => {
      // window.cpp:3466 states the ceiling and set_content_scale_factor never
      // checks it, so it is the inspector's limit, not the engine's.
      expect(check('content_scale_factor', '20')?.severity).toBe('warning');
    });

    it('rejects content_scale_factor at or below 0 — the one bound set_content_scale_factor (window.cpp:1774) actually enforces', () => {
      expect(check('content_scale_factor', '0')?.severity).toBe('error');
      expect(check('content_scale_factor', '-1')?.severity).toBe('error');
    });
  });

  describe('accessibility (accessibility_name, accessibility_description)', () => {
    it('accepts quoted strings', () => {
      expect(check('accessibility_name', '"Main window"')).toBeNull();
      expect(check('accessibility_description', '"The application main window"')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('accessibility_name', 'Main window')?.message).toContain('quoted');
      expect(check('accessibility_description', 'unquoted')?.message).toContain('quoted');
    });
  });

  describe('theme (theme, theme_type_variation)', () => {
    it('accepts a resource reference for theme', () => {
      expect(check('theme', 'SubResource("Theme_abc123")')).toBeNull();
      expect(check('theme', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a non-reference theme value', () => {
      expect(check('theme', '"not-a-resource"')).not.toBeNull();
    });

    it('accepts theme_type_variation as StringName (&"...") or a plain quoted string', () => {
      expect(check('theme_type_variation', '&"TitleWindow"')).toBeNull();
      expect(check('theme_type_variation', '"TitleWindow"')).toBeNull();
    });

    it('rejects an unquoted theme_type_variation', () => {
      expect(check('theme_type_variation', 'TitleWindow')).not.toBeNull();
    });
  });

  describe('theme overrides (wildcard keys)', () => {
    it('accepts theme_override_colors/<name> as Color', () => {
      expect(check('theme_override_colors/title_color', 'Color(1, 1, 1, 1)')).toBeNull();
    });

    it('rejects a malformed theme_override_colors/<name>', () => {
      expect(check('theme_override_colors/title_color', 'not-a-color')).not.toBeNull();
    });

    it('accepts theme_override_constants/<name> within -16384..16384', () => {
      expect(check('theme_override_constants/title_height', '36')).toBeNull();
      expect(check('theme_override_constants/close_h_offset', '-16384')).toBeNull();
      expect(check('theme_override_constants/close_h_offset', '16384')).toBeNull();
    });

    it('rejects theme_override_constants/<name> outside -16384..16384 (both bounds are hard)', () => {
      expect(check('theme_override_constants/title_height', '16385')?.message).toContain(
        'between -16384 and 16384'
      );
      expect(check('theme_override_constants/title_height', '-16385')?.message).toContain(
        'between -16384 and 16384'
      );
    });

    it('accepts theme_override_fonts/<name> and theme_override_styles/<name> as resource references', () => {
      expect(check('theme_override_fonts/title_font', 'ExtResource("2")')).toBeNull();
      expect(check('theme_override_styles/embedded_border', 'SubResource("StyleBoxFlat_1")')).toBeNull();
    });

    it('accepts theme_override_font_sizes/<name> at its hard lower bound (256 is a soft or_greater cap)', () => {
      expect(check('theme_override_font_sizes/title_font_size', '1')).toBeNull();
      expect(check('theme_override_font_sizes/title_font_size', '400')).toBeNull();
    });

    it('rejects theme_override_font_sizes/<name> below 1', () => {
      expect(check('theme_override_font_sizes/title_font_size', '0')).not.toBeNull();
    });

    it('accepts theme_override_icons/<name> as a resource reference', () => {
      expect(check('theme_override_icons/close', 'ExtResource("3")')).toBeNull();
    });
  });
});
