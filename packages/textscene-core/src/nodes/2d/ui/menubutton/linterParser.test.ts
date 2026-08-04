/**
 * MenuButton strict validators, format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. This slice ships no `linter.ts`: MenuButton has no
 * engine-grounded cross-field check of its own (see comparison.md).
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('MenuButton', property);
  expect(validator, `no validator registered for MenuButton.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('MenuButton strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('MenuButton')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('MenuButton')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('switch_on_hover', () => {
    it('accepts true and false', () => {
      expect(check('switch_on_hover', 'true')).toBeNull();
      expect(check('switch_on_hover', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('switch_on_hover', 'maybe')?.code).toBe('INVALID_SWITCH_ON_HOVER_FORMAT');
    });
  });

  describe('item_count', () => {
    it('accepts zero and a positive count', () => {
      expect(check('item_count', '0')).toBeNull();
      expect(check('item_count', '8')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('item_count', 'many')?.code).toBe('INVALID_ITEM_COUNT_FORMAT');
    });
    it('errors below 0: set_item_count is ERR_FAIL_COND(p_count < 0) (menu_button.cpp:124)', () => {
      expect(check('item_count', '-1')?.severity).toBe('error');
    });
  });

  describe('base-walk resolves inherited properties', () => {
    it('resolves alignment from Button', () => {
      expect(validatorRegistry.findValidator('MenuButton', 'alignment')).not.toBeNull();
      expect(check('alignment', '1')).toBeNull();
      expect(check('alignment', 'not-an-enum')).not.toBeNull();
    });
    it('resolves toggle_mode from BaseButton', () => {
      expect(validatorRegistry.findValidator('MenuButton', 'toggle_mode')).not.toBeNull();
      expect(check('toggle_mode', 'true')).toBeNull();
      expect(check('toggle_mode', 'maybe')).not.toBeNull();
    });
    it('resolves anchor_right from Control', () => {
      expect(validatorRegistry.findValidator('MenuButton', 'anchor_right')).not.toBeNull();
      expect(check('anchor_right', '1.0')).toBeNull();
      expect(check('anchor_right', 'not-a-float')).not.toBeNull();
    });
    it('resolves modulate from CanvasItem', () => {
      expect(validatorRegistry.findValidator('MenuButton', 'modulate')).not.toBeNull();
      expect(check('modulate', 'Color(1, 1, 1, 1)')).toBeNull();
      expect(check('modulate', 'not-a-color')).not.toBeNull();
    });
  });

  describe('the popup/item_<idx>/<leaf> family', () => {
    /**
     * `PropertyListHelper` glues the index straight onto the prefix: a real
     * key is `popup/item_0/text` (property_list_helper.cpp:149,
     * menu_button.cpp:213's `set_prefix("popup/item_")`), confirmed against
     * scenes/demos/gui/control_gallery/control_gallery.tscn:527. It resolves
     * through the `popup/item_#/*` pattern.
     */
    it('resolves a real per-item key through the indexed wildcard', () => {
      expect(validatorRegistry.findValidator('MenuButton', 'popup/item_0/text')).not.toBeNull();
      expect(validatorRegistry.findValidator('MenuButton', 'popup/item_12/checked')).not.toBeNull();
    });

    it('rejects a key whose index is not an integer, as the engine does', () => {
      // property_list_helper.cpp:126 requires is_valid_int() on the trimmed
      // prefix, so these are not keys Godot would read either.
      expect(validatorRegistry.findValidator('MenuButton', 'popup/item_x/text')).toBeNull();
      expect(validatorRegistry.findValidator('MenuButton', 'popup/item_-1/text')).toBeNull();
      expect(validatorRegistry.findValidator('MenuButton', 'popup/item_/text')).toBeNull();
    });

    it('does not resolve the bare item_<idx>/<leaf> shape: that key belongs to PopupMenu, not MenuButton', () => {
      expect(validatorRegistry.findValidator('MenuButton', 'item_0/text')).toBeNull();
    });

    const dispatcher = validatorRegistry.findValidator('MenuButton', 'popup/item_0/text');

    it('is registered under its own pattern', () => {
      expect(dispatcher).not.toBeNull();
    });

    it('accepts every leaf at a valid value', () => {
      expect(dispatcher!('popup/item_0/text', '"Open"', 1)).toBeNull();
      expect(dispatcher!('popup/item_0/icon', 'SubResource("1")', 1)).toBeNull();
      expect(dispatcher!('popup/item_0/checkable', '0', 1)).toBeNull();
      expect(dispatcher!('popup/item_0/checkable', '1', 1)).toBeNull();
      expect(dispatcher!('popup/item_0/checkable', '2', 1)).toBeNull();
      expect(dispatcher!('popup/item_0/checked', 'true', 1)).toBeNull();
      expect(dispatcher!('popup/item_0/id', '0', 1)).toBeNull();
      expect(dispatcher!('popup/item_0/disabled', 'false', 1)).toBeNull();
      expect(dispatcher!('popup/item_0/separator', 'false', 1)).toBeNull();
    });

    it('parses a multi-digit index', () => {
      expect(dispatcher!('popup/item_12/checked', 'true', 1)).toBeNull();
    });

    it('rejects a malformed text value', () => {
      expect(dispatcher!('popup/item_0/text', 'unquoted', 1)).not.toBeNull();
    });

    it('rejects a malformed icon reference', () => {
      expect(dispatcher!('popup/item_0/icon', 'not-a-resource', 1)).not.toBeNull();
    });

    it('errors on an out-of-range checkable: _set_item_checkable_type drops an unmatched value (popup_menu.cpp:62-73)', () => {
      const error = dispatcher!('popup/item_0/checkable', '3', 1);
      expect(error?.severity).toBe('error');
    });

    it('warns on a negative id: set_item_id assigns straight through (popup_menu.cpp:2099)', () => {
      const error = dispatcher!('popup/item_0/id', '-1', 1);
      expect(error?.severity).toBe('warning');
    });

    it('rejects a malformed checked/disabled/separator value', () => {
      expect(dispatcher!('popup/item_0/checked', 'maybe', 1)).not.toBeNull();
      expect(dispatcher!('popup/item_0/disabled', 'maybe', 1)).not.toBeNull();
      expect(dispatcher!('popup/item_0/separator', 'maybe', 1)).not.toBeNull();
    });

    it('errors on a negative item index: property_list_helper.cpp:58 refuses it entirely', () => {
      const error = dispatcher!('popup/item_-1/text', '"Open"', 1);
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_ITEM_INDEX');
    });

    it('rejects an unknown leaf name', () => {
      const error = dispatcher!('popup/item_0/tooltip', '"hi"', 1);
      expect(error?.code).toBe('INVALID_ITEM_KEY');
    });

    it('rejects a key with no numeric index at all', () => {
      const error = dispatcher!('popup/item_/text', '"hi"', 1);
      expect(error?.code).toBe('INVALID_ITEM_KEY');
    });
  });
});
