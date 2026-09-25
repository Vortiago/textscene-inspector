/**
 * ReferenceRect strict validators: format and range checks, asserted through
 * `validatorRegistry` so a failure points at the validator, not at scene parsing.
 * Each numeric bound quotes its governing Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ReferenceRect', property);
  expect(validator, `no validator registered for ReferenceRect.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * From reference_rect.cpp:98-100: three ADD_PROPERTY calls, none
 * `overrides=`-only in doc/classes/ReferenceRect.xml: border_color,
 * border_width, editor_only.
 */
const KEYS: string[] = ['border_color', 'border_width', 'editor_only'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('ReferenceRect strict validators', () => {
  it('registers exactly what ReferenceRect binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('ReferenceRect').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture against only this test's imports. `fixtureLint` runs
    // it against the whole registry.
    expectFixtureClean('unit-reference-rect.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('ReferenceRect')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // reference_rect.cpp:98: ADD_PROPERTY(PropertyInfo(Variant::COLOR,
  // "border_color"), "set_border_color", "get_border_color"); PROPERTY_HINT_NONE,
  // and set_border_color (reference_rect.cpp:48-55) assigns straight through.
  describe('border_color', () => {
    it('accepts a typical value', () => {
      expect(check('border_color', 'Color(1, 0, 0, 1)')).toBeNull();
    });

    it('rejects a non-Color value', () => {
      expect(check('border_color', 'not-a-color')?.code).toBe('INVALID_BORDER_COLOR_FORMAT');
    });

    it('accepts components outside 0-1, since a Color has no numeric bound (HDR is legal)', () => {
      expect(check('border_color', 'Color(2.5, -1, 0, 1)')).toBeNull();
    });
  });

  // reference_rect.cpp:99: ADD_PROPERTY(PropertyInfo(Variant::FLOAT,
  // "border_width", PROPERTY_HINT_RANGE, "0.0,5.0,0.1,or_greater,suffix:px"),
  // "set_border_width", "get_border_width");
  describe('border_width', () => {
    it('accepts a typical value', () => {
      expect(check('border_width', '2.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('border_width', 'wide')?.code).toBe('INVALID_BORDER_WIDTH_FORMAT');
    });

    it('accepts exactly the floor, since set_border_width clamps to MAX(0.0, p_width), so 0 is in range', () => {
      expect(check('border_width', '0.0')).toBeNull();
    });

    it('rejects a negative value as an ERROR: the setter clamps it, it does not merely hint it (reference_rect.cpp:62)', () => {
      const result = check('border_width', '-1.0');
      expect(result?.code).toBe('INVALID_BORDER_WIDTH_VALUE');
      expect(result?.severity).toBe('error');
    });

    it('accepts far above the hinted 5.0 ceiling, since the hint carries or_greater, which opens the max end', () => {
      expect(check('border_width', '500.0')).toBeNull();
    });
  });

  // reference_rect.cpp:100: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "editor_only"), "set_editor_only", "get_editor_only"); PROPERTY_HINT_NONE,
  // and set_editor_only (reference_rect.cpp:75-82) assigns straight through.
  describe('editor_only', () => {
    it('accepts true', () => {
      expect(check('editor_only', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('editor_only', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('editor_only', 'maybe')?.code).toBe('INVALID_EDITOR_ONLY_FORMAT');
    });
  });

  it('resolves anchor_right through the Control base-walk', () => {
    expect(check('anchor_right', '1.0')).toBeNull();
    expect(check('anchor_right', 'not-a-float')?.code).toBe('INVALID_ANCHOR_RIGHT_FORMAT');
  });

  it('resolves modulate through the CanvasItem base-walk', () => {
    expect(check('modulate', 'Color(1, 1, 1, 1)')).toBeNull();
    expect(check('modulate', 'not-a-color')?.code).toBe('INVALID_MODULATE_FORMAT');
  });
});
