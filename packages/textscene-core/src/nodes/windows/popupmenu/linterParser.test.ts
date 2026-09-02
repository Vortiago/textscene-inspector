/**
 * PopupMenu strict validators, format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through
 * `Linter`: the item index's high end is a cross-property bound no validator
 * can see.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('PopupMenu', property);
  expect(validator, `no validator registered for PopupMenu.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('PopupMenu strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('PopupMenu')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('PopupMenu')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('hide_on_item_selection', () => {
    it('accepts true and false', () => {
      expect(check('hide_on_item_selection', 'true')).toBeNull();
      expect(check('hide_on_item_selection', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('hide_on_item_selection', 'maybe')?.code).toBe(
        'INVALID_HIDE_ON_ITEM_SELECTION_FORMAT'
      );
    });
  });

  describe('hide_on_checkable_item_selection', () => {
    it('accepts true and false', () => {
      expect(check('hide_on_checkable_item_selection', 'true')).toBeNull();
      expect(check('hide_on_checkable_item_selection', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('hide_on_checkable_item_selection', 'maybe')).not.toBeNull();
    });
  });

  describe('hide_on_state_item_selection', () => {
    it('accepts true and false', () => {
      expect(check('hide_on_state_item_selection', 'true')).toBeNull();
      expect(check('hide_on_state_item_selection', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('hide_on_state_item_selection', 'maybe')).not.toBeNull();
    });
  });

  describe('allow_search', () => {
    it('accepts true and false', () => {
      expect(check('allow_search', 'true')).toBeNull();
      expect(check('allow_search', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('allow_search', 'maybe')).not.toBeNull();
    });
  });

  describe('prefer_native_menu', () => {
    it('accepts true and false', () => {
      expect(check('prefer_native_menu', 'true')).toBeNull();
      expect(check('prefer_native_menu', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('prefer_native_menu', 'maybe')).not.toBeNull();
    });
  });

  describe('shrink_height', () => {
    it('accepts true and false', () => {
      expect(check('shrink_height', 'true')).toBeNull();
      expect(check('shrink_height', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('shrink_height', 'maybe')).not.toBeNull();
    });
  });

  describe('shrink_width', () => {
    it('accepts true and false', () => {
      expect(check('shrink_width', 'true')).toBeNull();
      expect(check('shrink_width', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('shrink_width', 'maybe')).not.toBeNull();
    });
  });

  describe('submenu_popup_delay', () => {
    it('accepts a positive float', () => {
      expect(check('submenu_popup_delay', '0.2')).toBeNull();
      expect(check('submenu_popup_delay', '5')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('submenu_popup_delay', 'soon')?.code).toBe(
        'INVALID_SUBMENU_POPUP_DELAY_FORMAT'
      );
    });
    it('rejects 0 and below as an error: set_submenu_popup_delay clamps it to 0.01 (popup_menu.cpp:3041-3042)', () => {
      const atZero = check('submenu_popup_delay', '0');
      expect(atZero?.severity).toBe('error');
      const negative = check('submenu_popup_delay', '-1');
      expect(negative?.severity).toBe('error');
    });
  });

  describe('system_menu_id', () => {
    it('accepts every id the hint names', () => {
      // popup_menu.cpp:3262 — "None:0,Application Menu:2,Window Menu:3,
      // Help Menu:4,Dock:5". The `:value` suffixes make the set sparse; the
      // underlying NativeMenu::SystemMenus enum is contiguous
      // (native_menu.cpp:125-130, native_menu.h:59-66).
      for (const value of ['0', '2', '3', '4', '5']) {
        expect(check('system_menu_id', value)).toBeNull();
      }
    });
    it('warns on 1 (MAIN_MENU_ID), the one id the hint skips', () => {
      // A hint-tier bound IS the hint, gap included. set_system_menu
      // (popup_menu.cpp:185-193) assigns it straight through, which is what
      // keeps this a warning rather than an error.
      expect(check('system_menu_id', '1')?.severity).toBe('warning');
    });
    it('names the ids it will take, and not the one it skips', () => {
      const message = check('system_menu_id', '6')?.message ?? '';
      expect(message).toContain('5=DOCK_MENU_ID');
      expect(message).not.toContain('1=MAIN_MENU_ID');
    });
    it('rejects a non-numeric value', () => {
      expect(check('system_menu_id', 'dock')?.code).toBe('INVALID_SYSTEM_MENU_ID_FORMAT');
    });
    it('warns outside 0-5: set_system_menu assigns unconditionally (popup_menu.cpp:185-193), so this is hinted not enforced', () => {
      expect(check('system_menu_id', '6')?.severity).toBe('warning');
    });
  });

  describe('item_count', () => {
    it('accepts zero and a positive count', () => {
      expect(check('item_count', '0')).toBeNull();
      expect(check('item_count', '4')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('item_count', 'many')?.code).toBe('INVALID_ITEM_COUNT_FORMAT');
    });
    it('errors below 0: set_item_count is ERR_FAIL_COND(p_count < 0) (popup_menu.cpp:2698)', () => {
      expect(check('item_count', '-1')?.severity).toBe('error');
    });
  });

  describe('base-walk resolves inherited Window properties', () => {
    it('resolves title', () => {
      expect(validatorRegistry.findValidator('PopupMenu', 'title')).not.toBeNull();
      expect(check('title', '"My Menu"')).toBeNull();
      expect(check('title', 'unquoted')).not.toBeNull();
    });
    it('resolves size', () => {
      expect(validatorRegistry.findValidator('PopupMenu', 'size')).not.toBeNull();
      expect(check('size', 'Vector2i(200, 100)')).toBeNull();
      expect(check('size', 'not-a-vector')).not.toBeNull();
    });
  });

  describe('the item_<idx>/<leaf> family (registered but not yet routed)', () => {
    /**
     * `PropertyListHelper` glues the index straight onto the prefix: a real
     * key is `item_0/text` (property_list_helper.cpp:149), but
     * `ValidatorRegistry`'s wildcard match requires the fixed prefix to be
     * followed immediately by a literal `/`, which `item_0/text` never is
     * (see this slice's `linterParser.ts` header). Godot glues the index onto
     * the prefix, so these resolve through the `item_#/*` pattern, not `item_/*`.
     */
    it('resolves a real per-item key through the indexed wildcard', () => {
      expect(validatorRegistry.findValidator('PopupMenu', 'item_0/text')).not.toBeNull();
      expect(validatorRegistry.findValidator('PopupMenu', 'item_12/checked')).not.toBeNull();
    });

    it('rejects a key whose index is not an integer, as the engine does', () => {
      // `PopupMenu::_set` routes per-item keys through
      // `property_helper.property_set_value` (popup_menu.cpp:3092), whose
      // `_get_property` returns nullptr unless the index `is_valid_int()`
      // (property_list_helper.cpp:53-55); `_set` then returns false and Godot
      // DROPS the write. Reporting that requires the key to reach the
      // dispatcher, so it routes rather than resolving to no validator.
      const nonNumeric = validatorRegistry.findValidator('PopupMenu', 'item_x/text');
      expect(nonNumeric).not.toBeNull();
      expect(nonNumeric!('item_x/text', '"x"', 1)?.severity).toBe('error');
      // A NEGATIVE index is a well-formed key Godot resolves and then refuses
      // (is_valid_int accepts the sign, property_list_helper.cpp:52, and the
      // index < 0 guard rejects it at :57). It must reach the dispatcher so the
      // diagnostic fires; returning null here meant a key the engine silently
      // drops read as clean.
      const negative = validatorRegistry.findValidator('PopupMenu', 'item_-1/text');
      expect(negative).not.toBeNull();
      expect(negative!('item_-1/text', '"x"', 1)?.code).toBe('INVALID_ITEM_INDEX');
      // An EMPTY index fails the same `is_valid_int()` gate
      // (property_list_helper.cpp:53), so the write is dropped and the key
      // routes to the dispatcher, which reports it as an unknown item key.
      const empty = validatorRegistry.findValidator('PopupMenu', 'item_/text');
      expect(empty!('item_/text', '"x"', 1)?.code).toBe('INVALID_ITEM_KEY');
    });

    const dispatcher = validatorRegistry.findValidator('PopupMenu', 'item_0/text');

    it('is registered under its own pattern', () => {
      expect(dispatcher).not.toBeNull();
    });

    it('accepts every leaf at a valid value', () => {
      expect(dispatcher!('item_0/text', '"Open"', 1)).toBeNull();
      expect(dispatcher!('item_0/icon', 'SubResource("1")', 1)).toBeNull();
      expect(dispatcher!('item_0/checkable', '0', 1)).toBeNull();
      expect(dispatcher!('item_0/checkable', '1', 1)).toBeNull();
      expect(dispatcher!('item_0/checkable', '2', 1)).toBeNull();
      expect(dispatcher!('item_0/checked', 'true', 1)).toBeNull();
      expect(dispatcher!('item_0/id', '0', 1)).toBeNull();
      expect(dispatcher!('item_0/disabled', 'false', 1)).toBeNull();
      expect(dispatcher!('item_0/separator', 'false', 1)).toBeNull();
    });

    it('parses a multi-digit index', () => {
      expect(dispatcher!('item_12/checked', 'true', 1)).toBeNull();
    });

    it('rejects a malformed text value', () => {
      expect(dispatcher!('item_0/text', 'unquoted', 1)).not.toBeNull();
    });

    it('rejects a malformed icon reference', () => {
      expect(dispatcher!('item_0/icon', 'not-a-resource', 1)).not.toBeNull();
    });

    it('errors on an out-of-range checkable: _set_item_checkable_type drops an unmatched value (popup_menu.cpp:62-73)', () => {
      const error = dispatcher!('item_0/checkable', '3', 1);
      expect(error?.severity).toBe('error');
    });

    it('warns on a negative id: set_item_id assigns straight through (popup_menu.cpp:2099)', () => {
      const error = dispatcher!('item_0/id', '-1', 1);
      expect(error?.severity).toBe('warning');
    });

    it('rejects a malformed checked/disabled/separator value', () => {
      expect(dispatcher!('item_0/checked', 'maybe', 1)).not.toBeNull();
      expect(dispatcher!('item_0/disabled', 'maybe', 1)).not.toBeNull();
      expect(dispatcher!('item_0/separator', 'maybe', 1)).not.toBeNull();
    });

    it('errors on a negative item index: property_list_helper.cpp:58 refuses it entirely', () => {
      const error = dispatcher!('item_-1/text', '"Open"', 1);
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_ITEM_INDEX');
    });

    it('rejects an unknown leaf name', () => {
      const error = dispatcher!('item_0/tooltip', '"hi"', 1);
      expect(error?.code).toBe('INVALID_ITEM_KEY');
    });

    it('rejects a key with no numeric index at all', () => {
      const error = dispatcher!('item_/text', '"hi"', 1);
      expect(error?.code).toBe('INVALID_ITEM_KEY');
    });
  });
});
