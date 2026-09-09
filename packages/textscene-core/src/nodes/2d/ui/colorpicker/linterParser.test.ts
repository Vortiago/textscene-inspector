/**
 * ColorPicker strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`
 * (ColorPicker ships none: see comparison.md).
 *
 * Grow this into one case per property (happy, malformed, and any bound) and
 * quote the governing Godot source line beside every numeric bound.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ColorPicker', property);
  expect(validator, `no validator registered for ColorPicker.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ColorPicker strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('ColorPicker')).not.toEqual([]);
  });

  it('registers exactly the 12 own members from doc/classes/ColorPicker.xml (no overrides=)', () => {
    expect(validatorRegistry.getOwnKeys('ColorPicker').sort()).toEqual([
      'can_add_swatches',
      'color',
      'color_mode',
      'color_modes_visible',
      'deferred_mode',
      'edit_alpha',
      'edit_intensity',
      'hex_visible',
      'picker_shape',
      'presets_visible',
      'sampler_visible',
      'sliders_visible',
    ]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('ColorPicker')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('color (Color, no hint)', () => {
    // color_picker.cpp:1993. set_pick_color delegates to _set_pick_color
    // (color_picker.cpp:324-340), a bare assignment with no clamp.
    it('accepts the documented default', () => {
      expect(check('color', 'Color(1, 1, 1, 1)')).toBeNull();
    });

    it('accepts a translucent color', () => {
      expect(check('color', 'Color(0.2, 0.4, 0.6, 0.5)')).toBeNull();
    });

    it('accepts components outside 0-1 (no clamp in the setter)', () => {
      expect(check('color', 'Color(2, -1, 0, 1)')).toBeNull();
    });

    it('rejects a malformed literal', () => {
      expect(check('color', 'Color(1, 1, 1)')).not.toBeNull();
    });
  });

  describe('edit_alpha (bool)', () => {
    // color_picker.cpp:1994. set_edit_alpha (color_picker.cpp:359-372) is a
    // bare bool assignment.
    it('accepts true (the documented default)', () => {
      expect(check('edit_alpha', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('edit_alpha', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('edit_alpha', 'maybe')).not.toBeNull();
    });
  });

  describe('edit_intensity (bool)', () => {
    // color_picker.cpp:1995. set_edit_intensity (color_picker.cpp:378-393) is
    // a bare bool assignment (it recomputes derived state, but never refuses).
    it('accepts true (the documented default)', () => {
      expect(check('edit_intensity', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('edit_intensity', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('edit_intensity', 'maybe')).not.toBeNull();
    });
  });

  describe('color_mode (enum 0-3, enforced)', () => {
    // color_picker.cpp:1996, PROPERTY_HINT_ENUM "RGB,HSV,LINEAR,OKHSL".
    // set_color_mode (color_picker.cpp:1242-1243) ERR_FAIL_INDEXes on
    // MODE_MAX before assigning, so out-of-range is an ERROR, not a warning.
    it('accepts 0 (MODE_RGB, the documented default)', () => {
      expect(check('color_mode', '0')).toBeNull();
    });

    it('accepts 1 (MODE_HSV)', () => {
      expect(check('color_mode', '1')).toBeNull();
    });

    it('accepts 2 (MODE_LINEAR, also the deprecated MODE_RAW alias)', () => {
      expect(check('color_mode', '2')).toBeNull();
    });

    it('accepts 3 (MODE_OKHSL)', () => {
      expect(check('color_mode', '3')).toBeNull();
    });

    it('errors on a value beyond the enum (4)', () => {
      const error = check('color_mode', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('errors on a negative value', () => {
      const error = check('color_mode', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('deferred_mode (bool)', () => {
    // color_picker.cpp:1997. set_deferred_mode (color_picker.cpp:1311-1313)
    // is a bare bool assignment.
    it('accepts false (the documented default)', () => {
      expect(check('deferred_mode', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('deferred_mode', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('deferred_mode', 'maybe')).not.toBeNull();
    });
  });

  describe('picker_shape (enum 0-6, enforced)', () => {
    // color_picker.cpp:1998, PROPERTY_HINT_ENUM "HSV Rectangle,HSV Rectangle
    // Wheel,VHS Circle,OKHSL Circle,OK HS Rectangle:5,OK HL Rectangle,None:4",
    // which by VALUE covers 0-6 contiguously (SHAPE_HSV_RECTANGLE=0 through
    // SHAPE_OK_HL_RECTANGLE=6, color_picker.h:113-122). set_picker_shape
    // (color_picker.cpp:853-854) ERR_FAIL_INDEXes on SHAPE_MAX before
    // assigning, so out-of-range is an ERROR.
    it('accepts 0 (SHAPE_HSV_RECTANGLE, the documented default)', () => {
      expect(check('picker_shape', '0')).toBeNull();
    });

    it('accepts 4 (SHAPE_NONE, reassigned via the hint\'s ":4" suffix)', () => {
      expect(check('picker_shape', '4')).toBeNull();
    });

    it('accepts 6 (SHAPE_OK_HL_RECTANGLE, the highest value)', () => {
      expect(check('picker_shape', '6')).toBeNull();
    });

    it('errors on a value beyond the enum (7)', () => {
      const error = check('picker_shape', '7');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('errors on a negative value', () => {
      const error = check('picker_shape', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('can_add_swatches (bool)', () => {
    // color_picker.cpp:1999. set_can_add_swatches (color_picker.cpp:1883-1895)
    // is a bare bool assignment.
    it('accepts true (the documented default)', () => {
      expect(check('can_add_swatches', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('can_add_swatches', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('can_add_swatches', 'maybe')).not.toBeNull();
    });
  });

  describe('sampler_visible (bool)', () => {
    // color_picker.cpp:2001. set_sampler_visible (color_picker.cpp:1925-1932)
    // is a bare bool assignment.
    it('accepts true (the documented default)', () => {
      expect(check('sampler_visible', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('sampler_visible', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('sampler_visible', 'maybe')).not.toBeNull();
    });
  });

  describe('color_modes_visible (bool)', () => {
    // color_picker.cpp:2002. set_modes_visible (color_picker.cpp:1913-1920)
    // is a bare bool assignment.
    it('accepts true (the documented default)', () => {
      expect(check('color_modes_visible', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('color_modes_visible', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('color_modes_visible', 'maybe')).not.toBeNull();
    });
  });

  describe('sliders_visible (bool)', () => {
    // color_picker.cpp:2003. set_sliders_visible (color_picker.cpp:1937-1944)
    // is a bare bool assignment.
    it('accepts true (the documented default)', () => {
      expect(check('sliders_visible', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('sliders_visible', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('sliders_visible', 'maybe')).not.toBeNull();
    });
  });

  describe('hex_visible (bool)', () => {
    // color_picker.cpp:2004. set_hex_visible (color_picker.cpp:1949-1956) is
    // a bare bool assignment.
    it('accepts true (the documented default)', () => {
      expect(check('hex_visible', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('hex_visible', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('hex_visible', 'maybe')).not.toBeNull();
    });
  });

  describe('presets_visible (bool)', () => {
    // color_picker.cpp:2005. set_presets_visible (color_picker.cpp:1901-1908)
    // is a bare bool assignment.
    it('accepts true (the documented default)', () => {
      expect(check('presets_visible', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('presets_visible', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('presets_visible', 'maybe')).not.toBeNull();
    });
  });

  describe('inheritance through the base-walk', () => {
    it('resolves an inherited Control key (anchor_right) on ColorPicker', () => {
      expect(check('anchor_right', '1.0')).toBeNull();
    });

    it('resolves an inherited CanvasItem key (modulate) on ColorPicker', () => {
      expect(check('modulate', 'Color(1, 1, 1, 1)')).toBeNull();
    });

    it('rejects `vertical`, which VBoxContainer fixes and ColorPicker inherits the removal of', () => {
      const validator = validatorRegistry.findValidator('ColorPicker', 'vertical');
      expect(validator).not.toBeNull();
      // Both literals fail: the property cannot be written at all on this
      // chain, so there is no "correct" value for it to accept.
      expect(validator!('vertical', 'true', 1)).not.toBeNull();
      expect(validator!('vertical', 'false', 1)).not.toBeNull();
    });

    it('inherits BoxContainer\'s own keys (alignment) through the base-walk', () => {
      expect(check('alignment', '1')).toBeNull();
    });
  });

  describe('the fixture, property by property', () => {
    // The fixture is the deliverable's "zero errors and zero warnings" claim,
    // made checkable without running the full `lint:tscn` pipeline (off limits
    // to this slice, see AGENTS.md): every `key = value` line under the
    // MyColorPicker node must resolve through the same `findValidator` walk
    // this file already exercises, and return null.
    const fixturePath = join(
      import.meta.dirname,
      '../../../../../../../scenes/fixtures/unit-color-picker.tscn'
    );
    const fixture = readFileSync(fixturePath, 'utf8');
    const nodeStart = fixture.indexOf('[node name="MyColorPicker"');
    const nodeBody = fixture.slice(fixture.indexOf('\n', nodeStart) + 1);
    const nextHeading = nodeBody.indexOf('\n[');
    const propertyLines = (nextHeading === -1 ? nodeBody : nodeBody.slice(0, nextHeading))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.includes('='));

    it('finds the MyColorPicker node and at least one property line', () => {
      expect(nodeStart).toBeGreaterThan(-1);
      expect(propertyLines.length).toBeGreaterThan(0);
    });

    it('carries no `vertical` property, which VBoxContainer removed', () => {
      expect(propertyLines.some((line) => line.startsWith('vertical'))).toBe(false);
    });

    for (const line of propertyLines) {
      const eq = line.indexOf('=');
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      it(`accepts fixture line \`${line}\` with no error or warning`, () => {
        const validator = validatorRegistry.findValidator('ColorPicker', key);
        expect(validator, `no validator resolves for ColorPicker.${key}`).not.toBeNull();
        expect(validator!(key, value, 1)).toBeNull();
      });
    }
  });
});
