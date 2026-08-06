/**
 * OptionButton strict validators, format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Cross-field behaviour (selected vs item_count) belongs in
 * linter.test.ts, through `Linter`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('OptionButton', property);
  expect(validator, `no validator registered for OptionButton.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('OptionButton strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('OptionButton')).not.toEqual([]);
  });

  it('rejects a malformed value on every own-key validator', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('OptionButton')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('selected', () => {
    it('accepts a typical index', () => {
      expect(check('selected', '1')).toBeNull();
    });
    it('accepts the "none selected" floor (-1)', () => {
      expect(check('selected', '-1')).toBeNull();
    });
    it('accepts a large index: the ceiling is a bound against item_count, a runtime sibling count no per-property validator can see', () => {
      expect(check('selected', '999')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('selected', 'first')?.code).toBe('INVALID_SELECTED_FORMAT');
    });
    it('errors below -1: _select_int returns without assigning when p_which < NONE_SELECTED (option_button.cpp:433), a silently dropped write', () => {
      const error = check('selected', '-2');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('fit_to_longest_item', () => {
    it('accepts true and false', () => {
      expect(check('fit_to_longest_item', 'true')).toBeNull();
      expect(check('fit_to_longest_item', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('fit_to_longest_item', 'maybe')).not.toBeNull();
    });
  });

  describe('allow_reselect', () => {
    it('accepts true and false', () => {
      expect(check('allow_reselect', 'true')).toBeNull();
      expect(check('allow_reselect', 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check('allow_reselect', 'maybe')).not.toBeNull();
    });
  });

  describe('item_count', () => {
    it('accepts zero and a positive count', () => {
      expect(check('item_count', '0')).toBeNull();
      expect(check('item_count', '5')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('item_count', 'three')?.code).toBe('INVALID_ITEM_COUNT_FORMAT');
    });
    it('errors below 0: set_item_count is ERR_FAIL_COND(p_count < 0) (option_button.cpp:310)', () => {
      expect(check('item_count', '-1')?.severity).toBe('error');
    });
  });

  describe('base-walk resolves inherited properties', () => {
    it('resolves alignment from Button', () => {
      expect(validatorRegistry.findValidator('OptionButton', 'alignment')).not.toBeNull();
      expect(check('alignment', '1')).toBeNull();
      expect(check('alignment', 'not-a-number')).not.toBeNull();
    });
    it('resolves toggle_mode from BaseButton', () => {
      expect(validatorRegistry.findValidator('OptionButton', 'toggle_mode')).not.toBeNull();
      expect(check('toggle_mode', 'true')).toBeNull();
      expect(check('toggle_mode', 'maybe')).not.toBeNull();
    });
    it('resolves anchor_right from Control', () => {
      expect(validatorRegistry.findValidator('OptionButton', 'anchor_right')).not.toBeNull();
      expect(check('anchor_right', '1.0')).toBeNull();
      expect(check('anchor_right', 'not-a-float')).not.toBeNull();
    });
    it('resolves modulate from CanvasItem', () => {
      expect(validatorRegistry.findValidator('OptionButton', 'modulate')).not.toBeNull();
      expect(check('modulate', 'Color(1, 1, 1, 1)')).toBeNull();
      expect(check('modulate', 'not-a-color')).not.toBeNull();
    });
  });

  // doc/classes/OptionButton.xml:10: "The Button.text and Button.icon
  // properties are set automatically based on the selected item. They
  // shouldn't be changed manually." That is prose, not a removal:
  // OptionButton::_validate_property (option_button.cpp:554-558) only clears
  // their PROPERTY_USAGE, and Button's own setters (set_text/set_button_icon,
  // called directly by OptionButton::_select at option_button.cpp:423-424)
  // still accept any value. Same shape as SpinBox.exp_edit / FileDialog.dialog_text.
  describe('text and icon (inherited from Button, not removed)', () => {
    it('does not register text/icon as OptionButton\'s own, and does not remove them', () => {
      expect(validatorRegistry.getOwnKeys('OptionButton')).not.toContain('text');
      expect(validatorRegistry.getOwnKeys('OptionButton')).not.toContain('icon');
      expect(validatorRegistry.getUnavailableKeys('OptionButton')).not.toContain('text');
      expect(validatorRegistry.getUnavailableKeys('OptionButton')).not.toContain('icon');
    });
    it('resolves text through Button\'s own validator', () => {
      expect(check('text', '"Pick one"')).toBeNull();
      expect(check('text', 'unquoted')).not.toBeNull();
    });
    it('resolves icon through Button\'s own validator', () => {
      expect(check('icon', 'SubResource("1")')).toBeNull();
      expect(check('icon', 'not-a-resource')).not.toBeNull();
    });
  });

  // Proves the popup/item_N/disabled wildcard leaf and BaseButton's top-level
  // `disabled` do not shadow one another: they are different keys resolved
  // by different hops of the same lookup.
  describe('top-level disabled (BaseButton) vs item-level disabled (own wildcard family)', () => {
    it('are distinct validators', () => {
      const topLevel = validatorRegistry.findValidator('OptionButton', 'disabled');
      const itemLevel = validatorRegistry.findValidator('OptionButton', 'popup/item_0/disabled');
      expect(topLevel).not.toBeNull();
      expect(itemLevel).not.toBeNull();
      expect(topLevel).not.toBe(itemLevel);
    });
    it('both accept true/false and reject anything else', () => {
      expect(check('disabled', 'true')).toBeNull();
      expect(check('disabled', 'maybe')).not.toBeNull();
      expect(check('popup/item_0/disabled', 'true')).toBeNull();
      expect(check('popup/item_0/disabled', 'maybe')).not.toBeNull();
    });
  });

  describe('the popup/item_<idx>/<leaf> family', () => {
    it('resolves a real per-item key through the indexed wildcard', () => {
      expect(validatorRegistry.findValidator('OptionButton', 'popup/item_0/text')).not.toBeNull();
      expect(
        validatorRegistry.findValidator('OptionButton', 'popup/item_12/disabled')
      ).not.toBeNull();
    });

    it('rejects a key whose index is not an integer, which the engine drops', () => {
      // `OptionButton::_set` gates on `property_helper.is_property_valid`
      // (option_button.cpp:166), which requires is_valid_int() on the trimmed
      // prefix (property_list_helper.cpp:126) and otherwise returns false, so
      // Godot DROPS the write. That is the error tier, so the key has to reach
      // the dispatcher rather than resolving to no validator.
      const nonNumeric = validatorRegistry.findValidator('OptionButton', 'popup/item_x/text');
      expect(nonNumeric).not.toBeNull();
      expect(nonNumeric!('popup/item_x/text', '"x"', 1)?.severity).toBe('error');
      // A NEGATIVE index is a well-formed key Godot resolves and then refuses
      // (is_valid_int accepts the sign, property_list_helper.cpp:52, and the
      // index < 0 guard rejects it at :57). It must reach the dispatcher so the
      // diagnostic fires; returning null here meant a key the engine silently
      // drops read as clean.
      const negative = validatorRegistry.findValidator('OptionButton', 'popup/item_-1/text');
      expect(negative).not.toBeNull();
      expect(negative!('popup/item_-1/text', '"x"', 1)?.code).toBe('INVALID_ITEM_INDEX');
      expect(validatorRegistry.findValidator('OptionButton', 'popup/item_/text')).toBeNull();
    });

    const dispatcher = validatorRegistry.findValidator('OptionButton', 'popup/item_0/text');

    it('is registered under its own pattern', () => {
      expect(dispatcher).not.toBeNull();
    });

    describe('text leaf', () => {
      it('accepts a quoted string', () => {
        expect(dispatcher!('popup/item_0/text', '"Easy"', 1)).toBeNull();
      });
      it('rejects an unquoted value', () => {
        expect(dispatcher!('popup/item_0/text', 'Easy', 1)).not.toBeNull();
      });
    });

    describe('icon leaf', () => {
      it('accepts a resource reference', () => {
        expect(dispatcher!('popup/item_0/icon', 'SubResource("1")', 1)).toBeNull();
        expect(dispatcher!('popup/item_0/icon', 'ExtResource("2")', 1)).toBeNull();
      });
      it('rejects a malformed reference', () => {
        expect(dispatcher!('popup/item_0/icon', 'not-a-resource', 1)).not.toBeNull();
      });
    });

    describe('id leaf', () => {
      it('accepts zero and a positive id', () => {
        expect(dispatcher!('popup/item_0/id', '0', 1)).toBeNull();
        expect(dispatcher!('popup/item_0/id', '42', 1)).toBeNull();
      });
      it('accepts a value past the hint\'s soft ceiling: "0,10,1,or_greater" opens the max end', () => {
        expect(dispatcher!('popup/item_0/id', '999', 1)).toBeNull();
      });
      it('rejects a non-numeric value', () => {
        expect(dispatcher!('popup/item_0/id', 'first', 1)).not.toBeNull();
      });
      it('warns on a negative id: PopupMenu::set_item_id assigns the value straight through (popup_menu.cpp:2099), so the floor is hinted not enforced', () => {
        const error = dispatcher!('popup/item_0/id', '-1', 1);
        expect(error?.severity).toBe('warning');
      });
    });

    describe('disabled leaf', () => {
      it('accepts true and false', () => {
        expect(dispatcher!('popup/item_0/disabled', 'true', 1)).toBeNull();
        expect(dispatcher!('popup/item_0/disabled', 'false', 1)).toBeNull();
      });
      it('rejects anything else', () => {
        expect(dispatcher!('popup/item_0/disabled', 'maybe', 1)).not.toBeNull();
      });
    });

    describe('separator leaf', () => {
      it('accepts true and false', () => {
        expect(dispatcher!('popup/item_0/separator', 'true', 1)).toBeNull();
        expect(dispatcher!('popup/item_0/separator', 'false', 1)).toBeNull();
      });
      it('rejects anything else', () => {
        expect(dispatcher!('popup/item_0/separator', 'maybe', 1)).not.toBeNull();
      });
    });

    it('parses a multi-digit index', () => {
      expect(dispatcher!('popup/item_12/disabled', 'true', 1)).toBeNull();
    });

    it('errors on a negative item index: property_list_helper.cpp:58 refuses it entirely, the same guard PopupMenu forwards through', () => {
      const error = dispatcher!('popup/item_-1/text', '"Easy"', 1);
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

    it('exposes its leaves for the grounding sweep to recurse through', () => {
      expect(dispatcher!.leaves).toBeDefined();
      expect(dispatcher!.leaves!.length).toBe(5);
    });
  });

  describe('the fixture, property by property', () => {
    // The fixture is the deliverable's "zero errors and zero warnings" claim,
    // made checkable without running the full `lint:tscn` pipeline (off limits
    // to this slice, see AGENTS.md): every `key = value` line under the
    // DifficultySelect node must resolve through the same `findValidator` walk
    // this file already exercises, and return null.
    const fixturePath = join(
      import.meta.dirname,
      '../../../../../../../scenes/fixtures/unit-optionbutton.tscn'
    );
    const fixture = readFileSync(fixturePath, 'utf8');
    const nodeStart = fixture.indexOf('[node name="DifficultySelect"');
    const nodeBody = fixture.slice(fixture.indexOf('\n', nodeStart) + 1);
    const nextHeading = nodeBody.indexOf('\n[');
    const propertyLines = (nextHeading === -1 ? nodeBody : nodeBody.slice(0, nextHeading))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.includes('='));

    it('finds the DifficultySelect node and at least one property line', () => {
      expect(nodeStart).toBeGreaterThan(-1);
      expect(propertyLines.length).toBeGreaterThan(0);
    });

    it('carries the new properties this slice added', () => {
      expect(propertyLines.some((line) => line.startsWith('fit_to_longest_item'))).toBe(true);
      expect(propertyLines.some((line) => line.startsWith('allow_reselect'))).toBe(true);
      expect(propertyLines.some((line) => line.startsWith('popup/item_2/disabled'))).toBe(true);
      expect(propertyLines.some((line) => line.startsWith('popup/item_2/separator'))).toBe(true);
    });

    for (const line of propertyLines) {
      const eq = line.indexOf('=');
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      it(`accepts fixture line \`${line}\` with no error or warning`, () => {
        const validator = validatorRegistry.findValidator('OptionButton', key);
        expect(validator, `no validator resolves for OptionButton.${key}`).not.toBeNull();
        expect(validator!(key, value, 1)).toBeNull();
      });
    }
  });
});
