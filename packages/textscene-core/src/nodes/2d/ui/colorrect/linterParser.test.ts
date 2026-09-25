/**
 * ColorRect strict validators: `color`, its one member in doc/classes/ColorRect.xml
 * and the `_bind_methods` of color_rect.cpp, and the inherited Control and CanvasItem keys beside it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error `color`'s validator returns for a value, or null when it accepts it. */
function check(value: string) {
  const validator = validatorRegistry.findValidator('ColorRect', 'color');
  expect(validator, 'no validator registered for ColorRect.color').not.toBeNull();
  return validator!('color', value, 1);
}

describe('ColorRect strict validators', () => {
  it('declares exactly its own `color` fill property', () => {
    expect(validatorRegistry.getOwnKeys('ColorRect')).toEqual(['color']);
  });

  it('accepts a well-formed Color', () => {
    expect(check('Color(0.85, 0.2, 0.2, 1)')).toBeNull();
  });

  it('accepts a translucent Color', () => {
    expect(check('Color(0.2, 0.4, 0.85, 0.5)')).toBeNull();
  });

  it('rejects a Color literal with the wrong arity', () => {
    // color_rect.cpp:65 declares Variant::COLOR. Godot cannot read an RGB-only
    // 3-tuple as a Color, so this is a format rejection, not a bound.
    const error = check('Color(1, 1, 1)');
    expect(error?.message).toContain('Color');
  });

  it('rejects a non-numeric value entirely', () => {
    expect(check('not-a-color')).not.toBeNull();
  });

  it('places no numeric bound on the color: HDR components outside 0-1 are legal', () => {
    // color_rect.cpp:65 has PROPERTY_HINT_NONE, and set_color (color_rect.cpp:33-40)
    // assigns any Color with no clamp or ERR_FAIL, so an HDR component is valid.
    expect(check('Color(2.5, -1, 0, 1)')).toBeNull();
  });

  it('reaches anchor_right through the Control base-walk, distinct from its own color key', () => {
    expect(validatorRegistry.findValidator('ColorRect', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('ColorRect')).not.toContain('anchor_right');
  });

  it('reaches modulate through the CanvasItem base-walk, distinct from its own color key', () => {
    // `modulate` tints the node and its children, and `color` is the fill. The
    // base-walk delivers both, and neither shadows the other.
    expect(validatorRegistry.findValidator('ColorRect', 'modulate')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('ColorRect')).not.toContain('modulate');
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-color-rect.tscn');
  });
});
