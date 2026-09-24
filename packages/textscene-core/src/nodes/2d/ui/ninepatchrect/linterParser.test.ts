/**
 * Tests the NinePatchRect strict validators through `validatorRegistry`, so a failure points at the
 * validator, not at scene parsing, and no fixture text needs upkeep. One case per property, with the Godot
 * source line beside every numeric bound. Rule behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('NinePatchRect', property);
  expect(validator, `no validator registered for NinePatchRect.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the source: the keys NinePatchRect binds, or DECLARES_NOTHING when it binds no
 * ADD_PROPERTY. Both unset is red on purpose. Never delete an assertion to go green.
 */
// nine_patch_rect.cpp:73-84: 9 ADD_PROPERTY/ADD_PROPERTYI calls. `mouse_filter` (NinePatchRect.xml:38)
// carries overrides="Control", so it is no own member.
const KEYS: string[] = [
  'axis_stretch_horizontal',
  'axis_stretch_vertical',
  'draw_center',
  'patch_margin_bottom',
  'patch_margin_left',
  'patch_margin_right',
  'patch_margin_top',
  'region_rect',
  'texture',
];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('NinePatchRect strict validators', () => {
  it('registers exactly what NinePatchRect binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('NinePatchRect').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's zero-diagnostic claim against what this test imports. `fixtureLint` runs the
    // whole registry but needs the barrel, which imports every slice.
    expectFixtureClean('unit-nine-patch-rect.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. Per-property cases follow this
    // generic check.
    const accepted = validatorRegistry
      .getOwnKeys('NinePatchRect')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // nine_patch_rect.h:39-43 / nine_patch_rect.cpp:86-88: STRETCH=0, TILE=1, TILE_FIT=2.
  // set_h_axis_stretch_mode (nine_patch_rect.cpp:164-171) and set_v_axis_stretch_mode (:177-184) assign
  // with no ERR_FAIL_INDEX, so a value off the enum breaches only the ADD_PROPERTY hint for the editor.
  describe.each([
    ['axis_stretch_horizontal', 83],
    ['axis_stretch_vertical', 84],
  ])('%s (nine_patch_rect.cpp:%d)', (property, _hint) => {
    it('accepts 0 (AXIS_STRETCH_MODE_STRETCH, the documented default)', () => {
      expect(check(property, '0')).toBeNull();
    });

    it('accepts 1 (AXIS_STRETCH_MODE_TILE)', () => {
      expect(check(property, '1')).toBeNull();
    });

    it('accepts 2 (AXIS_STRETCH_MODE_TILE_FIT, the top of the range)', () => {
      expect(check(property, '2')).toBeNull();
    });

    it('a value beyond the enum (3) is only a WARNING', () => {
      const error = check(property, '3');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('a value below the enum (-1) is also only a WARNING', () => {
      const error = check(property, '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check(property, 'stretch')).not.toBeNull();
    });
  });

  describe('draw_center', () => {
    it('accepts true (the documented default)', () => {
      expect(check('draw_center', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('draw_center', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('draw_center', 'center')).not.toBeNull();
    });
  });

  // One ADD_PROPERTYI per side, each hinting "0,16384,1,suffix:px" with no or_greater/or_less.
  // set_patch_margin (nine_patch_rect.cpp:120-130) ERR_FAIL_INDEXes the side argument and assigns the
  // value, so both closed ends are hinted only: a warning.
  describe.each([
    ['patch_margin_left', 78],
    ['patch_margin_top', 79],
    ['patch_margin_right', 80],
    ['patch_margin_bottom', 81],
  ])('%s', (property, cite) => {
    it('accepts 0', () => {
      expect(check(property, '0')).toBeNull();
    });

    it('accepts 16384 (the top of the hinted range)', () => {
      expect(check(property, '16384')).toBeNull();
    });

    it(`a value beyond the hint (16385) is only a WARNING (nine_patch_rect.cpp:${cite})`, () => {
      const error = check(property, '16385');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it(`a negative value is also only a WARNING (nine_patch_rect.cpp:${cite})`, () => {
      const error = check(property, '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check(property, 'wide')).not.toBeNull();
    });
  });

  describe('region_rect', () => {
    it('accepts Rect2(0, 0, 0, 0) (the documented default)', () => {
      expect(check('region_rect', 'Rect2(0, 0, 0, 0)')).toBeNull();
    });

    it('accepts an arbitrary Rect2, since set_region_rect (nine_patch_rect.cpp:137-145) assigns straight through and ADD_PROPERTY (nine_patch_rect.cpp:75) is PROPERTY_HINT_NONE', () => {
      expect(check('region_rect', 'Rect2(0, 0, 32, 32)')).toBeNull();
    });

    it('rejects a malformed Rect2 literal', () => {
      expect(check('region_rect', 'Rect2(0, 0)')).not.toBeNull();
    });
  });

  describe('texture', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture', 'SubResource("PlaceholderTexture2D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('texture', '"not a resource"')).not.toBeNull();
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a Control key (anchor_right) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('NinePatchRect', 'anchor_right')).not.toBeNull();
    });

    it('resolves a CanvasItem key (modulate) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('NinePatchRect', 'modulate')).not.toBeNull();
    });
  });
});
