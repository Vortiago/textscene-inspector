/**
 * TabContainer strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property, happy, malformed, and any bound, and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';
// Only for the "separate PropertyListHelper instance" assertion below: this
// slice's own module graph never otherwise imports TabBar.
import '../tabbar/linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TabContainer', property);
  expect(validator, `no validator registered for TabContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('TabContainer strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('TabContainer')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('TabContainer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // tab_container.cpp:1208, ADD_PROPERTY(..., "tab_alignment", PROPERTY_HINT_ENUM,
  // "Left,Center,Right"); TabBar::set_tab_alignment ERR_FAIL_INDEX(p_alignment,
  // ALIGNMENT_MAX) at tab_bar.cpp:1671, ALIGNMENT_MAX=3.
  describe('tab_alignment', () => {
    it('accepts Left (0)', () => {
      expect(check('tab_alignment', '0')).toBeNull();
    });

    it('accepts Right (2)', () => {
      expect(check('tab_alignment', '2')).toBeNull();
    });

    it('rejects 3 as an error: ALIGNMENT_MAX enforces the ceiling', () => {
      const error = check('tab_alignment', '3');
      expect(error?.severity).toBe('error');
    });

    it('rejects a negative value as an error', () => {
      const error = check('tab_alignment', '-1');
      expect(error?.severity).toBe('error');
    });
  });

  // tab_container.cpp:1209, PROPERTY_HINT_RANGE "-1,4096,1". The floor is
  // enforced through TabBar::set_current_tab's ERR_FAIL_INDEX (tab_bar.cpp:804);
  // the ceiling is the hint's alone, so it warns.
  describe('current_tab', () => {
    it('accepts -1, the "no tab selected" sentinel', () => {
      expect(check('current_tab', '-1')).toBeNull();
    });

    it('accepts a typical positive index', () => {
      expect(check('current_tab', '0')).toBeNull();
    });

    it('rejects -2 as an error: below the enforced floor', () => {
      const error = check('current_tab', '-2');
      expect(error?.severity).toBe('error');
    });

    it('accepts the hint ceiling exactly (4096, tab_container.cpp:1209)', () => {
      expect(check('current_tab', '4096')).toBeNull();
    });

    it('warns above 4096: the setter assigns through, only the hint names that end', () => {
      const diagnostic = check('current_tab', '4097');
      expect(diagnostic).not.toBeNull();
      expect(diagnostic?.severity).toBe('warning');
    });
  });

  // tab_container.cpp:1210, PROPERTY_HINT_ENUM "Top,Bottom"; TabContainer's own
  // set_tabs_position ERR_FAIL_INDEX(p_tabs_position, POSITION_MAX) at
  // tab_container.cpp:820, POSITION_MAX=2.
  describe('tabs_position', () => {
    it('accepts Top (0)', () => {
      expect(check('tabs_position', '0')).toBeNull();
    });

    it('accepts Bottom (1)', () => {
      expect(check('tabs_position', '1')).toBeNull();
    });

    it('rejects 2 as an error: POSITION_MAX enforces the ceiling', () => {
      const error = check('tabs_position', '2');
      expect(error?.severity).toBe('error');
    });
  });

  // tab_container.cpp:1211, plain BOOL, no hint.
  describe('clip_tabs', () => {
    it('accepts true', () => {
      expect(check('clip_tabs', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('clip_tabs', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('clip_tabs', 'yes')).not.toBeNull();
    });
  });

  // tab_container.cpp:1212, plain BOOL, no hint.
  describe('tabs_visible', () => {
    it('accepts true', () => {
      expect(check('tabs_visible', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('tabs_visible', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('tabs_visible', '1')).not.toBeNull();
    });
  });

  // tab_container.cpp:1213, plain BOOL, no hint.
  describe('all_tabs_in_front', () => {
    it('accepts true', () => {
      expect(check('all_tabs_in_front', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('all_tabs_in_front', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('all_tabs_in_front', 'maybe')).not.toBeNull();
    });
  });

  // tab_container.cpp:1214, plain BOOL, no hint.
  describe('switch_on_drag_hover', () => {
    it('accepts true', () => {
      expect(check('switch_on_drag_hover', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('switch_on_drag_hover', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('switch_on_drag_hover', 'nope')).not.toBeNull();
    });
  });

  // tab_container.cpp:1215, plain BOOL, no hint.
  describe('drag_to_rearrange_enabled', () => {
    it('accepts true', () => {
      expect(check('drag_to_rearrange_enabled', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('drag_to_rearrange_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('drag_to_rearrange_enabled', 'on')).not.toBeNull();
    });
  });

  // tab_container.cpp:1216, plain INT, PROPERTY_HINT_NONE. TabBar::set_tabs_
  // rearrange_group bare-assigns with no ERR_FAIL and no clamp.
  describe('tabs_rearrange_group', () => {
    it('accepts -1, the "no rearrange group" sentinel', () => {
      expect(check('tabs_rearrange_group', '-1')).toBeNull();
    });

    it('accepts an arbitrary positive group id', () => {
      expect(check('tabs_rearrange_group', '7')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('tabs_rearrange_group', 'group')).not.toBeNull();
    });
  });

  // tab_container.cpp:1217, plain BOOL, no hint.
  describe('use_hidden_tabs_for_min_size', () => {
    it('accepts true', () => {
      expect(check('use_hidden_tabs_for_min_size', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('use_hidden_tabs_for_min_size', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('use_hidden_tabs_for_min_size', '0')).not.toBeNull();
    });
  });

  // tab_container.cpp:1218, PROPERTY_HINT_ENUM "None,Click,All" (0-2).
  // Control::set_focus_mode's ERR_FAIL_INDEX((int)p_focus_mode, 4)
  // (control.cpp:2267) accepts a 4th value the hint never lists, so
  // out-of-hint is a warning, not an error.
  describe('tab_focus_mode', () => {
    it('accepts None (0)', () => {
      expect(check('tab_focus_mode', '0')).toBeNull();
    });

    it('accepts All (2)', () => {
      expect(check('tab_focus_mode', '2')).toBeNull();
    });

    it('warns on 3: Control::set_focus_mode accepts Accessibility, but no label names it here', () => {
      const error = check('tab_focus_mode', '3');
      expect(error?.severity).toBe('warning');
    });

    it('rejects a negative value as a warning too, since the enum bound has one severity', () => {
      const error = check('tab_focus_mode', '-1');
      expect(error?.severity).toBe('warning');
    });
  });

  // tab_container.cpp:1219, plain BOOL, no hint.
  describe('deselect_enabled', () => {
    it('accepts true', () => {
      expect(check('deselect_enabled', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('deselect_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('deselect_enabled', 'enabled')).not.toBeNull();
    });
  });

  it('inherits Control layout keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('TabContainer', 'anchor_right')).not.toBeNull();
  });

  it('inherits CanvasItem keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('TabContainer', 'modulate')).not.toBeNull();
  });

  describe('tab_<i>/* (tab_container.cpp:1270-1276, own PropertyListHelper family)', () => {
    it('accepts a quoted title', () => {
      expect(check('tab_0/title', '"General"')).toBeNull();
    });

    it('accepts a resource reference for icon', () => {
      expect(check('tab_0/icon', 'SubResource("PlaceholderTexture2D_1")')).toBeNull();
    });

    it('accepts disabled/hidden booleans', () => {
      expect(check('tab_0/disabled', 'true')).toBeNull();
      expect(check('tab_1/hidden', 'false')).toBeNull();
    });

    it('rejects an unrecognised leaf (tooltip belongs to TabBar, not TabContainer)', () => {
      const error = check('tab_0/tooltip', '"nope"');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_TABCONTAINER_TAB_KEY');
    });

    it('rejects a negative tab index (property_list_helper.cpp:58)', () => {
      const error = check('tab_-1/title', '"X"');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_TABCONTAINER_TAB_INDEX');
    });

    it('does not shadow TabBar\'s own tab_<i>/* family (a separate PropertyListHelper instance)', () => {
      // TabBar accepts `tooltip`; TabContainer does not.
      expect(validatorRegistry.findValidator('TabBar', 'tab_0/tooltip')).not.toBeNull();
    });
  });
});
