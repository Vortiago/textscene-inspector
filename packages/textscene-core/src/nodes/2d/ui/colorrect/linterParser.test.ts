/**
 * ColorRect strict validators — the single `color` fill property, plus proof
 * the base-walk still delivers Control's and CanvasItem's inherited keys
 * without colliding with it.
 *
 * doc/classes/ColorRect.xml lists exactly one member, `color`, and
 * color_rect.cpp's `_bind_methods` binds exactly one `ADD_PROPERTY` to match.
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
    // color_rect.cpp:65 declares Variant::COLOR; the RGB-only 3-tuple Godot's
    // own parser could not read as a Color is a format rejection, not a bound.
    const error = check('Color(1, 1, 1)');
    expect(error?.message).toContain('Color');
  });

  it('rejects a non-numeric value entirely', () => {
    expect(check('not-a-color')).not.toBeNull();
  });

  it('places no numeric bound on the color: HDR components outside 0-1 are legal', () => {
    // color_rect.cpp:65, ADD_PROPERTY carries no PROPERTY_HINT at all
    // (PROPERTY_HINT_NONE). set_color (color_rect.cpp:33-40) assigns any
    // Color unaltered once it differs from the current one, no clamp, no
    // ERR_FAIL — a component past 0-1 (HDR) is exactly as valid as one inside.
    expect(check('Color(2.5, -1, 0, 1)')).toBeNull();
  });

  it('reaches anchor_right through the Control base-walk, distinct from its own color key', () => {
    expect(validatorRegistry.findValidator('ColorRect', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('ColorRect')).not.toContain('anchor_right');
  });

  it('reaches modulate through the CanvasItem base-walk, distinct from its own color key', () => {
    // CanvasItem's `modulate` tints the whole node (and its children); the
    // rect's own `color` is the fill it draws. Same Color shape, two separate
    // properties, and the base-walk must deliver both without one shadowing
    // the other.
    expect(validatorRegistry.findValidator('ColorRect', 'modulate')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('ColorRect')).not.toContain('modulate');
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-color-rect.tscn');
  });
});
