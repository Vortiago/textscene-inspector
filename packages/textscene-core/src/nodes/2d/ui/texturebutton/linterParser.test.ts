/**
 * Tests the TextureButton strict validators through `validatorRegistry`, not by linting a
 * `.tscn`, so a failure points at the validator. The only cross-field rule is BaseButton's
 * button-group rule, which `basebutton/linter.test.ts` covers, so no `linter.ts` here.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TextureButton', property);
  expect(validator, `no validator registered for TextureButton.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('TextureButton strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('TextureButton')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format.
    const accepted = validatorRegistry
      .getOwnKeys('TextureButton')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('flip_h', () => {
    it('accepts true', () => {
      expect(check('flip_h', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('flip_h', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('flip_h', 'sideways')).not.toBeNull();
    });
  });

  describe('flip_v', () => {
    it('accepts true', () => {
      expect(check('flip_v', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('flip_v', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('flip_v', 'upside-down')).not.toBeNull();
    });
  });

  describe('ignore_texture_size', () => {
    it('accepts true', () => {
      expect(check('ignore_texture_size', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('ignore_texture_size', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('ignore_texture_size', 'nope')).not.toBeNull();
    });
  });

  describe('stretch_mode', () => {
    // texture_button.h:39-47 / texture_button.cpp:286-292: STRETCH_SCALE=0 ..
    // STRETCH_KEEP_ASPECT_COVERED=6.
    it('accepts 0 (STRETCH_SCALE)', () => {
      expect(check('stretch_mode', '0')).toBeNull();
    });

    it('accepts 2 (STRETCH_KEEP, the documented default)', () => {
      expect(check('stretch_mode', '2')).toBeNull();
    });

    it('accepts 6 (STRETCH_KEEP_ASPECT_COVERED, the top of the range)', () => {
      expect(check('stretch_mode', '6')).toBeNull();
    });

    it('a value beyond the enum (7) is only a WARNING, since set_stretch_mode (texture_button.cpp:383-390) assigns straight through with no ERR_FAIL_INDEX and the ADD_PROPERTY hint (texture_button.cpp:282) only constrains the editor', () => {
      const error = check('stretch_mode', '7');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('stretch_mode', 'scale')).not.toBeNull();
    });
  });

  describe('texture_click_mask', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture_click_mask', 'SubResource("BitMap_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture_click_mask', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('texture_click_mask', '"not a resource"')).not.toBeNull();
    });
  });

  describe('texture_disabled', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture_disabled', 'SubResource("PlaceholderTexture2D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture_disabled', 'ExtResource("2")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('texture_disabled', '"not a resource"')).not.toBeNull();
    });
  });

  describe('texture_focused', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture_focused', 'SubResource("PlaceholderTexture2D_2")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture_focused', 'ExtResource("3")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('texture_focused', '"not a resource"')).not.toBeNull();
    });
  });

  describe('texture_hover', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture_hover', 'SubResource("PlaceholderTexture2D_3")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture_hover', 'ExtResource("4")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('texture_hover', '"not a resource"')).not.toBeNull();
    });
  });

  describe('texture_normal', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture_normal', 'SubResource("PlaceholderTexture2D_4")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture_normal', 'ExtResource("5")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('texture_normal', '"not a resource"')).not.toBeNull();
    });
  });

  describe('texture_pressed', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture_pressed', 'SubResource("PlaceholderTexture2D_5")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture_pressed', 'ExtResource("6")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('texture_pressed', '"not a resource"')).not.toBeNull();
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a BaseButton key (toggle_mode) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('TextureButton', 'toggle_mode')).not.toBeNull();
    });

    it('resolves a Control key (anchor_right) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('TextureButton', 'anchor_right')).not.toBeNull();
    });

    it('resolves a CanvasItem key (modulate) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('TextureButton', 'modulate')).not.toBeNull();
    });

    it('does NOT resolve Button-only alignment, since TextureButton descends from BaseButton, not Button', () => {
      expect(validatorRegistry.findValidator('TextureButton', 'alignment')).toBeNull();
    });
  });
});
