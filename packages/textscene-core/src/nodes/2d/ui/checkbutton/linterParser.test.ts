/**
 * CheckButton strict validators: format and range checks.
 *
 * CheckButton declares no member of its own (see linterParser.ts for the
 * source citations), so the real content of this slice's test is that the
 * base-walk still resolves every inherited key a scene author can set on a
 * CheckButton: `toggle_mode` and `button_pressed` from BaseButton,
 * `anchor_right` from Control, `modulate` from CanvasItem.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CheckButton', property);
  expect(validator, `no validator registered for CheckButton.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('CheckButton strict validators', () => {
  it('declares no members of its own: check_button.cpp binds no ADD_PROPERTY', () => {
    expect(validatorRegistry.getOwnKeys('CheckButton')).toEqual([]);
  });

  it('resolves toggle_mode through the BaseButton base-walk', () => {
    expect(check('toggle_mode', 'true')).toBeNull();
    expect(check('toggle_mode', 'false')).toBeNull();
    expect(check('toggle_mode', 'maybe')?.code).toBe('INVALID_TOGGLE_MODE_FORMAT');
  });

  it('resolves button_pressed through the BaseButton base-walk', () => {
    expect(check('button_pressed', 'true')).toBeNull();
    expect(check('button_pressed', 'false')).toBeNull();
    expect(check('button_pressed', 'maybe')?.code).toBe('INVALID_BUTTON_PRESSED_FORMAT');
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
