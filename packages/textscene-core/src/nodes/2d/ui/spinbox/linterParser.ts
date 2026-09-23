/**
 * SpinBox strict validators: only the members doc/classes/SpinBox.xml lists without `overrides=`.
 * `size_flags_vertical` and `step` (default="1.0") override Control and Range defaults, so those
 * ancestors keep their rules, and the rest arrives through the NODE_BASE_TYPES base-walk.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { HORIZONTAL_ALIGNMENT } from '../../../../linter/validators/globalScopeEnums.js';

// `exp_edit` keeps Range's validator. SpinBox::_validate_property (spin_box.cpp:647-650) sets its
// usage to PROPERTY_USAGE_NONE, which hides it and stops the saver, but `Range::set_exp_ratio`
// (range.cpp:433-440) still assigns and scene/gui/spin_box.h overrides nothing. A hand-authored
// `exp_edit = true` loads: inert, not invalid, like FileDialog::dialog_text.
validatorRegistry.registerAll('SpinBox', {
  // spin_box.cpp:673: ADD_PROPERTY(PropertyInfo(Variant::INT, "alignment", PROPERTY_HINT_ENUM,
  // "Left,Center,Right,Fill"), ...). set_horizontal_alignment (:542-544) forwards to LineEdit's,
  // which is `ERR_FAIL_INDEX((int)p_alignment, 4)` (line_edit.cpp:1072), so the range is enforced.
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
  // spin_box.cpp:678: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "custom_arrow_step",
  // PROPERTY_HINT_RANGE, "0,10000,0.0001,or_greater"), …). set_custom_arrow_step (:615-617) only
  // assigns, so the bound is hinted. `or_greater` opens the max end, and the min end (0) stays closed.
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
