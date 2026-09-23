/**
 * ColorPickerButton strict validators (scene/gui/color_picker.cpp, scene/gui/color_picker.h:507). They declare only
 * the members doc/classes/ColorPickerButton.xml lists without `overrides=`: the
 * NODE_BASE_TYPES base-walk delivers the inherited keys, and a redeclared key shadows its ancestor.
 */

// `toggle_mode` is `overrides="BaseButton" default="true"`, a default the constructor sets
// (color_picker.cpp:2551), so BaseButton's validator covers it.
import '../button/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// Each member forwards to the internal ColorPicker once `_update_picker` builds one
// (color_picker.cpp:2505-2524). Its setters are bare assignments too (set_pick_color
// color_picker.cpp:343-345, set_edit_alpha color_picker.cpp:359-372, set_edit_intensity
// color_picker.cpp:378-398), so no member has a bound.
validatorRegistry.registerAll('ColorPickerButton', {
  // color_picker.cpp:2540. set_pick_color (color_picker.cpp:2451-2461) is a bare
  // assignment. Its early return skips an unchanged value and refuses none.
  color: v.color('color'),
  // color_picker.cpp:2541. set_edit_alpha (color_picker.cpp:2467-2475) is a
  // bare bool assignment.
  edit_alpha: v.boolean('edit_alpha'),
  // color_picker.cpp:2542. set_edit_intensity (color_picker.cpp:2481-2489) is
  // a bare bool assignment.
  edit_intensity: v.boolean('edit_intensity'),
});
