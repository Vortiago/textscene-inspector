/**
 * TabBar strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property (happy, malformed, and any bound) and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TabBar', property);
  expect(validator, `no validator registered for TabBar.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * TabBar binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  // The 13 ADD_PROPERTY calls, tab_bar.cpp:2123-2135.
  'current_tab',
  'tab_alignment',
  'clip_tabs',
  'close_with_middle_mouse',
  'tab_close_display_policy',
  'max_tab_width',
  'scrolling_enabled',
  'drag_to_rearrange_enabled',
  'switch_on_drag_hover',
  'tabs_rearrange_group',
  'scroll_to_selected',
  'select_with_rmb',
  'deselect_enabled',
  // ADD_ARRAY_COUNT, tab_bar.cpp:2137, which is an ADD_PROPERTY of its own
  // (class_db.cpp:1492) and so serialises like the rest.
  'tab_count',
  // The PropertyListHelper family, tab_bar.cpp:2188-2193.
  'tab_#/*',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('TabBar strict validators', () => {
  it('registers exactly what TabBar binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('TabBar').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-tab-bar.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('TabBar')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('tab_count', () => {
    it('accepts zero and a positive count', () => {
      expect(check('tab_count', '0')).toBeNull();
      expect(check('tab_count', '3')).toBeNull();
    });
    it('accepts a very large count: nothing anywhere caps it, the hint is PROPERTY_HINT_NONE (class_db.cpp:1492)', () => {
      expect(check('tab_count', '100000')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('tab_count', 'three')?.code).toBe('INVALID_TAB_COUNT_FORMAT');
    });
    it('errors below 0: set_tab_count is ERR_FAIL_COND(p_count < 0) (tab_bar.cpp:745)', () => {
      const error = check('tab_count', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('current_tab', () => {
    it('accepts an ordinary index', () => {
      expect(check('current_tab', '0')).toBeNull();
      expect(check('current_tab', '2')).toBeNull();
    });
    it('accepts the "nothing selected" floor (-1), the property default', () => {
      expect(check('current_tab', '-1')).toBeNull();
    });
    it('accepts the hint ceiling exactly (4096, tab_bar.cpp:2123)', () => {
      expect(check('current_tab', '4096')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('current_tab', 'first')?.code).toBe('INVALID_CURRENT_TAB_FORMAT');
    });
    it('errors below -1: set_current_tab reaches ERR_FAIL_INDEX(p_current, get_tab_count()) (tab_bar.cpp:804), which refuses any negative index other than the -1 deselect sentinel', () => {
      const error = check('current_tab', '-2');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
    it('warns above 4096: the setter assigns straight through, only the PROPERTY_HINT_RANGE "-1,4096,1" (tab_bar.cpp:2123) names that end and it carries no or_greater', () => {
      const diagnostic = check('current_tab', '4097');
      expect(diagnostic).not.toBeNull();
      expect(diagnostic?.severity).toBe('warning');
    });
  });

  describe('max_tab_width', () => {
    it('accepts 0 (the default, meaning unlimited) and a real width', () => {
      expect(check('max_tab_width', '0')).toBeNull();
      expect(check('max_tab_width', '120')).toBeNull();
    });
    it('accepts the hint ceiling exactly (99999, tab_bar.cpp:2128)', () => {
      expect(check('max_tab_width', '99999')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('max_tab_width', 'wide')?.code).toBe('INVALID_MAX_TAB_WIDTH_FORMAT');
    });
    it('errors below 0: set_max_tab_width is ERR_FAIL_COND(p_width < 0) (tab_bar.cpp:1966)', () => {
      const error = check('max_tab_width', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
    it('warns above 99999: PROPERTY_HINT_RANGE "0,99999,1,suffix:px" (tab_bar.cpp:2128) closes that end but the setter assigns it straight through', () => {
      const diagnostic = check('max_tab_width', '100000');
      expect(diagnostic).not.toBeNull();
      expect(diagnostic?.severity).toBe('warning');
    });
  });

  describe('tab_alignment', () => {
    it('accepts every AlignmentMode constant', () => {
      expect(check('tab_alignment', '0')).toBeNull();
      expect(check('tab_alignment', '1')).toBeNull();
      expect(check('tab_alignment', '2')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('tab_alignment', 'center')).not.toBeNull();
    });
    it('errors at ALIGNMENT_MAX and above: ERR_FAIL_INDEX(p_alignment, ALIGNMENT_MAX) (tab_bar.cpp:1671), ALIGNMENT_MAX = 3 (tab_bar.h:47)', () => {
      const error = check('tab_alignment', '3');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
    it('errors below 0: the same ERR_FAIL_INDEX refuses a negative index', () => {
      expect(check('tab_alignment', '-1')?.severity).toBe('error');
    });
  });

  describe('tab_close_display_policy', () => {
    it('accepts every CloseButtonDisplayPolicy constant', () => {
      expect(check('tab_close_display_policy', '0')).toBeNull();
      expect(check('tab_close_display_policy', '1')).toBeNull();
      expect(check('tab_close_display_policy', '2')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('tab_close_display_policy', 'always')).not.toBeNull();
    });
    it('errors at CLOSE_BUTTON_MAX and above: ERR_FAIL_INDEX(p_policy, CLOSE_BUTTON_MAX) (tab_bar.cpp:1944), CLOSE_BUTTON_MAX = 3 (tab_bar.h:54)', () => {
      const error = check('tab_close_display_policy', '3');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
    it('errors below 0: the same ERR_FAIL_INDEX refuses a negative index', () => {
      expect(check('tab_close_display_policy', '-1')?.severity).toBe('error');
    });
  });

  describe('tabs_rearrange_group', () => {
    it('accepts -1, the "no group" default', () => {
      expect(check('tabs_rearrange_group', '-1')).toBeNull();
    });
    it('accepts any group id: set_tabs_rearrange_group is a bare assignment (tab_bar.cpp:2004) under PROPERTY_HINT_NONE (tab_bar.cpp:2132), so neither end is bounded', () => {
      expect(check('tabs_rearrange_group', '0')).toBeNull();
      expect(check('tabs_rearrange_group', '7')).toBeNull();
      expect(check('tabs_rearrange_group', '-99')).toBeNull();
    });
    it('rejects a non-numeric value', () => {
      expect(check('tabs_rearrange_group', 'group-a')?.code).toBe(
        'INVALID_TABS_REARRANGE_GROUP_FORMAT'
      );
    });
  });

  describe.each([
    ['clip_tabs'],
    ['close_with_middle_mouse'],
    ['scrolling_enabled'],
    ['drag_to_rearrange_enabled'],
    ['switch_on_drag_hover'],
    ['scroll_to_selected'],
    ['select_with_rmb'],
    ['deselect_enabled'],
  ])('%s (Variant::BOOL, tab_bar.cpp:2125-2135)', (property) => {
    it('accepts true and false', () => {
      expect(check(property, 'true')).toBeNull();
      expect(check(property, 'false')).toBeNull();
    });
    it('rejects anything else', () => {
      expect(check(property, 'maybe')).not.toBeNull();
      expect(check(property, '1')).not.toBeNull();
    });
  });

  describe('tab_<idx>/<leaf> family', () => {
    it('accepts each of the four leaves PropertyListHelper registers (tab_bar.cpp:2190-2193)', () => {
      expect(check('tab_0/title', '"Inventory"')).toBeNull();
      expect(check('tab_1/tooltip', '"Everything you carry"')).toBeNull();
      expect(check('tab_2/icon', 'SubResource("PlaceholderTexture2D_1")')).toBeNull();
      expect(check('tab_0/disabled', 'true')).toBeNull();
    });
    it('accepts a multi-digit index: the glue is vformat("%s%d/%s") (property_list_helper.cpp:149), not a fixed width', () => {
      expect(check('tab_12/title', '"Twelve"')).toBeNull();
    });
    it('accepts an ExtResource icon as well as a SubResource one', () => {
      expect(check('tab_0/icon', 'ExtResource("1_icon")')).toBeNull();
    });
    it('rejects an unquoted title', () => {
      expect(check('tab_0/title', 'Inventory')).not.toBeNull();
    });
    it('rejects a non-resource icon', () => {
      expect(check('tab_0/icon', '"res://icon.svg"')).not.toBeNull();
    });
    it('rejects a non-boolean disabled', () => {
      expect(check('tab_0/disabled', 'yes')).not.toBeNull();
    });
    it('rejects a leaf TabBar never registered', () => {
      // `metadata`, `hidden`, `language`, `text_direction`, `button_icon` and
      // `icon_max_width` all have bound setters (tab_bar.cpp:2060-2079) but no
      // `register_property` call, so no such key ever reaches a setter.
      const error = check('tab_0/metadata', '"anything"');
      expect(error?.code).toBe('INVALID_TAB_KEY');
    });
    it('rejects a negative index: _get_property returns nullptr for index < 0 (property_list_helper.cpp:58) and the write never lands', () => {
      const error = check('tab_-1/title', '"Ghost"');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_TAB_INDEX');
      expect(error?.severity).toBe('error');
    });
    it('rejects a non-integer index, which the helper never resolves', () => {
      // `TabBar::_set` is `property_helper.property_set_value` verbatim
      // (tab_bar.h:208) and `_get_property` returns nullptr unless the index
      // `is_valid_int()` (property_list_helper.cpp:53-55), so `_set` returns
      // false and Godot DROPS the write.
      expect(check('tab_x/title', '"Ghost"')?.code).toBe('INVALID_TAB_KEY');
      expect(check('tab_1.5/title', '"Ghost"')?.severity).toBe('error');
    });
    it('accepts an index past the live tab_count: that bound is against a sibling property, so linter.ts owns it', () => {
      expect(check('tab_99/title', '"Far"')).toBeNull();
    });
    it('leaves the plain tab_-prefixed scalars to their exact registrations, not the wildcard', () => {
      // The prefix `tab_` collides with `tab_alignment`, `tab_count` and
      // `tab_close_display_policy`; the exact match must win.
      expect(check('tab_alignment', '1')).toBeNull();
      expect(check('tab_count', '3')).toBeNull();
      expect(check('tab_close_display_policy', '2')).toBeNull();
    });
  });
});
