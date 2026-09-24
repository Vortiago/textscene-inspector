/**
 * ColorPickerButton strict validators, asserted through `validatorRegistry` so
 * a failure points at the validator and not at scene parsing.
 * ColorPickerButton has no rules (comparison.md).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ColorPickerButton', property);
  expect(validator, `no validator registered for ColorPickerButton.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ColorPickerButton strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('ColorPickerButton')).not.toEqual([]);
  });

  it('registers exactly the 3 own members from doc/classes/ColorPickerButton.xml (no overrides=)', () => {
    // `toggle_mode` is `overrides="BaseButton" default="true"` (a default
    // change, not a new property), so it is not in this list even though the
    // constructor sets it (color_picker.cpp:2551).
    expect(validatorRegistry.getOwnKeys('ColorPickerButton').sort()).toEqual([
      'color',
      'edit_alpha',
      'edit_intensity',
    ]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('ColorPickerButton')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('color (Color, no hint)', () => {
    // color_picker.cpp:2540. set_pick_color (color_picker.cpp:2451-2461) is a
    // bare assignment with no clamp; it forwards to the internal ColorPicker
    // only once one exists, and that delegate (color_picker.cpp:343-345) is a
    // bare assignment too.
    it('accepts the documented default', () => {
      expect(check('color', 'Color(0, 0, 0, 1)')).toBeNull();
    });

    it('accepts a translucent color', () => {
      expect(check('color', 'Color(0.8, 0.3, 0.5, 0.6)')).toBeNull();
    });

    it('accepts components outside 0-1 (no clamp in the setter)', () => {
      expect(check('color', 'Color(2, -1, 0, 1)')).toBeNull();
    });

    it('rejects a malformed literal', () => {
      expect(check('color', 'Color(1, 1, 1)')).not.toBeNull();
    });
  });

  describe('edit_alpha (bool)', () => {
    // color_picker.cpp:2541. set_edit_alpha (color_picker.cpp:2467-2475) is a
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
    // color_picker.cpp:2542. set_edit_intensity (color_picker.cpp:2481-2489)
    // is a bare bool assignment.
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

  describe('inheritance through the base-walk', () => {
    it('resolves a Button key (alignment) on ColorPickerButton', () => {
      expect(check('alignment', '1')).toBeNull();
    });

    it('resolves a BaseButton key (toggle_mode) on ColorPickerButton', () => {
      expect(check('toggle_mode', 'true')).toBeNull();
    });

    it('resolves a Control key (anchor_right) on ColorPickerButton', () => {
      expect(check('anchor_right', '1.0')).toBeNull();
    });

    it('resolves a CanvasItem key (modulate) on ColorPickerButton', () => {
      expect(check('modulate', 'Color(1, 1, 1, 1)')).toBeNull();
    });
  });

  describe('the fixture, property by property', () => {
    // Every `key = value` line under the MyColorPickerButton node resolves through
    // `findValidator` and returns null: the fixture lints clean without `lint:tscn`.
    const fixturePath = join(
      import.meta.dirname,
      '../../../../../../../scenes/fixtures/unit-color-picker-button.tscn'
    );
    const fixture = readFileSync(fixturePath, 'utf8');
    const nodeStart = fixture.indexOf('[node name="MyColorPickerButton"');
    const nodeBody = fixture.slice(fixture.indexOf('\n', nodeStart) + 1);
    const nextHeading = nodeBody.indexOf('\n[');
    const propertyLines = (nextHeading === -1 ? nodeBody : nodeBody.slice(0, nextHeading))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.includes('='));

    it('finds the MyColorPickerButton node and at least one property line', () => {
      expect(nodeStart).toBeGreaterThan(-1);
      expect(propertyLines.length).toBeGreaterThan(0);
    });

    it('carries at least one own member (color, edit_alpha or edit_intensity)', () => {
      const ownKeys = new Set(['color', 'edit_alpha', 'edit_intensity']);
      const keys = propertyLines.map((line) => line.slice(0, line.indexOf('=')).trim());
      expect(keys.some((key) => ownKeys.has(key))).toBe(true);
    });

    for (const line of propertyLines) {
      const eq = line.indexOf('=');
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      it(`accepts fixture line \`${line}\` with no error or warning`, () => {
        const validator = validatorRegistry.findValidator('ColorPickerButton', key);
        expect(validator, `no validator resolves for ColorPickerButton.${key}`).not.toBeNull();
        expect(validator!(key, value, 1)).toBeNull();
      });
    }
  });
});
