/**
 * ColorPickerButton strict validators for linting.
 *
 * Declare only ColorPickerButton's OWN members: the ones doc/classes/ColorPickerButton.xml
 * lists without an `overrides=` attribute. Everything from Button up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule. `toggle_mode`
 * is `overrides="BaseButton" default="true"`: a default-value change the
 * constructor applies with `set_toggle_mode(true)` (color_picker.cpp:2551), not
 * a new property, so it is skipped here and BaseButton's own validator keeps
 * covering it.
 *
 * ColorPickerButton lives alongside ColorPicker in scene/gui/color_picker.cpp
 * (class declared scene/gui/color_picker.h:507). Its three own members forward
 * to a lazily-constructed internal ColorPicker once one exists
 * (`_update_picker`, color_picker.cpp:2505-2524), but every delegate setter
 * (ColorPicker::set_pick_color color_picker.cpp:343-345, set_edit_alpha
 * color_picker.cpp:359-372, set_edit_intensity color_picker.cpp:378-398) is a
 * bare assignment with no clamp or ERR_FAIL, matching ColorPickerButton's own
 * setters below, so nothing here carries a numeric or enum bound.
 */

import '../button/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ColorPickerButton', {
  // color_picker.cpp:2540. set_pick_color (color_picker.cpp:2451-2461) is a
  // bare assignment (the early return on an unchanged value skips redundant
  // work, it does not refuse a different one); it forwards to the internal
  // picker only once one exists.
  color: v.color('color'),
  // color_picker.cpp:2541. set_edit_alpha (color_picker.cpp:2467-2475) is a
  // bare bool assignment.
  edit_alpha: v.boolean('edit_alpha'),
  // color_picker.cpp:2542. set_edit_intensity (color_picker.cpp:2481-2489) is
  // a bare bool assignment.
  edit_intensity: v.boolean('edit_intensity'),
});
