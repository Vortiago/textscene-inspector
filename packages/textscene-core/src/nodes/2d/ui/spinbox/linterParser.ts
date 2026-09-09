/**
 * SpinBox strict validators for linting.
 *
 * Declare only SpinBox's OWN members: the ones doc/classes/SpinBox.xml lists
 * without an `overrides=` attribute. `size_flags_vertical` (overrides
 * Control) and `step` (overrides Range, default="1.0") are default-value
 * overrides, not new properties, and are skipped: Control and Range already
 * own them, and re-declaring either here would shadow the ancestor's rule.
 *
 * `exp_edit` (a Range member) is NOT modelled as a removal here, despite
 * SpinBox::_validate_property (spin_box.cpp:647-650) clearing its usage to
 * PROPERTY_USAGE_NONE. That only hides the key from the inspector and stops
 * Godot's own saver from emitting it; it does not touch the setter.
 * `Range::set_exp_ratio` (range.cpp:433-440) early-returns only when the new
 * value equals the current one and otherwise assigns unconditionally;
 * SpinBox overrides no method that guards it further (scene/gui/spin_box.h
 * declares no override of set_exp_ratio). So a hand-authored `exp_edit =
 * true` on a SpinBox node is a value Godot's own deserializer accepts
 * without complaint, exactly the FileDialog::dialog_text case
 * (nodes/windows/filedialog/linterParser.ts): inert, not invalid. `exp_edit`
 * is left to inherit Range's validator unchanged.
 *
 * Everything else, the whole Range/Control/CanvasItem/Node set, arrives
 * through the NODE_BASE_TYPES base-walk and is not re-declared here.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { HORIZONTAL_ALIGNMENT } from '../../../../linter/validators/globalScopeEnums.js';

// spin_box.cpp:673: ADD_PROPERTY(PropertyInfo(Variant::INT, "alignment",
// PROPERTY_HINT_ENUM, "Left,Center,Right,Fill"), "set_horizontal_alignment",
// "get_horizontal_alignment"). SpinBox::set_horizontal_alignment (:542-544)
// forwards straight to LineEdit::set_horizontal_alignment, which is
// `ERR_FAIL_INDEX((int)p_alignment, 4)` (line_edit.cpp:1072): the delegate
// carries the guard, so out-of-range is enforced, not merely hinted.

validatorRegistry.registerAll('SpinBox', {
  alignment: v.enumInt('alignment', 0, 3, HORIZONTAL_ALIGNMENT, { enforced: 'line_edit.cpp:1072' }),
  // spin_box.cpp:674: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "editable"), …).
  // SpinBox::set_editable (:602-605) forwards to LineEdit::set_editable
  // (line_edit.cpp:2565-2570), a bare assignment with an early return only
  // when the value is unchanged: no guard either side.
  editable: v.boolean('editable'),
  // spin_box.cpp:675: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "update_on_text_changed"), …). set_update_on_text_changed (:576-586) is a
  // bare assignment (plus a signal (dis)connect side effect).
  update_on_text_changed: v.boolean('update_on_text_changed'),
  // spin_box.cpp:676: ADD_PROPERTY(PropertyInfo(Variant::STRING, "prefix"),
  // …), no hint. set_prefix (:563-569) is a bare assignment.
  prefix: v.quotedString('prefix'),
  // spin_box.cpp:677: ADD_PROPERTY(PropertyInfo(Variant::STRING, "suffix"),
  // …), no hint. set_suffix (:550-556) is a bare assignment.
  suffix: v.quotedString('suffix'),
  // spin_box.cpp:678: ADD_PROPERTY(PropertyInfo(Variant::FLOAT,
  // "custom_arrow_step", PROPERTY_HINT_RANGE, "0,10000,0.0001,or_greater"),
  // …). set_custom_arrow_step (:615-617) is a bare assignment, so the bound
  // is hinted rather than enforced. `or_greater` opens the max end; the
  // absence of `or_less` keeps the min end (0) closed.
  custom_arrow_step: v.float('custom_arrow_step', { min: 0, hinted: 'spin_box.cpp:678' }),
  // spin_box.cpp:679: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "custom_arrow_round"), …). set_custom_arrow_round (:623-625) is a bare
  // assignment.
  custom_arrow_round: v.boolean('custom_arrow_round'),
  // spin_box.cpp:680: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "select_all_on_focus"), …). SpinBox::set_select_all_on_focus (:594-596)
  // forwards to LineEdit::set_select_all_on_focus, a bare assignment.
  select_all_on_focus: v.boolean('select_all_on_focus'),
});
