/**
 * BaseButton strict validators: format and range checks through `validatorRegistry`,
 * not a linted `.tscn`, so a failure points at the validator rather than at scene parsing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('BaseButton', property);
  expect(validator, `no validator registered for BaseButton.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('BaseButton strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('BaseButton')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose. Per-property cases below are the real check.
    const accepted = validatorRegistry
      .getOwnKeys('BaseButton')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('disabled', () => {
    it('accepts true', () => {
      expect(check('disabled', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('disabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('disabled', 'yes')).not.toBeNull();
    });
  });

  describe('toggle_mode', () => {
    it('accepts true', () => {
      expect(check('toggle_mode', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('toggle_mode', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('toggle_mode', '1')).not.toBeNull();
    });
  });

  describe('button_pressed', () => {
    it('accepts true', () => {
      expect(check('button_pressed', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('button_pressed', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('button_pressed', 'maybe')).not.toBeNull();
    });
  });

  describe('action_mode', () => {
    // base_button.cpp:570/586-587: ACTION_MODE_BUTTON_PRESS=0, ACTION_MODE_BUTTON_RELEASE=1.
    it('accepts 0 (ACTION_MODE_BUTTON_PRESS)', () => {
      expect(check('action_mode', '0')).toBeNull();
    });

    it('accepts 1 (ACTION_MODE_BUTTON_RELEASE, the documented default)', () => {
      expect(check('action_mode', '1')).toBeNull();
    });

    it('rejects a value beyond the enum (2)', () => {
      expect(check('action_mode', '2')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('action_mode', '-1')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('action_mode', 'button_press')).not.toBeNull();
    });
  });

  describe('button_mask', () => {
    it('accepts the documented default (1, Mouse Left)', () => {
      expect(check('button_mask', '1')).toBeNull();
    });

    it('accepts a combined mask (Mouse Left + Mouse Right = 3)', () => {
      expect(check('button_mask', '3')).toBeNull();
    });

    it('accepts 0 (no mouse button responds)', () => {
      expect(check('button_mask', '0')).toBeNull();
    });

    it('accepts a bit beyond the 3 named editor flags (XBUTTON1 = 128)', () => {
      // base_button.cpp:394-396: set_button_mask assigns the BitField with no
      // clamp, and MouseButtonMask extends to MOUSE_BUTTON_MASK_MB_XBUTTON1/2
      // (doc/classes/@GlobalScope.xml), so a value beyond the 3-flag hint is not malformed.
      expect(check('button_mask', '128')).toBeNull();
    });

    it('accepts a negative value — the mask carries no PROPERTY_HINT_RANGE, and base_button.cpp:394-396 bare-assigns, so no Godot statement backs a floor', () => {
      expect(check('button_mask', '-1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('button_mask', 'left')).not.toBeNull();
    });
  });

  describe('keep_pressed_outside', () => {
    it('accepts true', () => {
      expect(check('keep_pressed_outside', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('keep_pressed_outside', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('keep_pressed_outside', 'nope')).not.toBeNull();
    });
  });

  describe('button_group', () => {
    it('accepts a SubResource reference', () => {
      expect(check('button_group', 'SubResource("ButtonGroup_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('button_group', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('button_group', '"not a resource"')).not.toBeNull();
    });
  });

  describe('shortcut', () => {
    it('accepts a SubResource reference', () => {
      expect(check('shortcut', 'SubResource("Shortcut_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('shortcut', 'ExtResource("2")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('shortcut', '"not a resource"')).not.toBeNull();
    });
  });

  describe('shortcut_feedback', () => {
    it('accepts true (the documented default)', () => {
      expect(check('shortcut_feedback', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('shortcut_feedback', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('shortcut_feedback', 'on')).not.toBeNull();
    });
  });

  describe('shortcut_in_tooltip', () => {
    it('accepts true (the documented default)', () => {
      expect(check('shortcut_in_tooltip', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('shortcut_in_tooltip', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('shortcut_in_tooltip', 'off')).not.toBeNull();
    });
  });

  it('never re-declares focus_mode (overrides="Control", owned by the ancestor)', () => {
    expect(validatorRegistry.getOwnKeys('BaseButton')).not.toContain('focus_mode');
  });
});
