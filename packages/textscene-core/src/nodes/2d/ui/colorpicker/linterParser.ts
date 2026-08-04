/**
 * ColorPicker strict validators for linting.
 *
 * Declare only ColorPicker's OWN members: the ones doc/classes/ColorPicker.xml
 * lists without an `overrides=` attribute. Everything from VBoxContainer up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Imports VBoxContainer's own linterParser (its direct parent), not
 * BoxContainer's, so VBoxContainer's `registerUnavailable` for `vertical`
 * actually runs before the base-walk reaches it: ColorPicker fixes no
 * orientation of its own, so it inherits VBoxContainer's removal of the key
 * rather than declaring anything about it here.
 *
 * `color_mode` and `picker_shape` are both `ERR_FAIL_INDEX`-guarded
 * (color_picker.cpp:1243, :854): the setter takes a `ColorModeType` /
 * `PickerShapeType` enum by value and refuses anything outside
 * `MODE_MAX` / `SHAPE_MAX`, so both are `enforced` even though each also
 * carries a matching `PROPERTY_HINT_ENUM` (ADR-0032: enforcement outranks an
 * agreeing hint).
 */

import '../vboxcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// color_picker.cpp:1996, PROPERTY_HINT_ENUM "RGB,HSV,LINEAR,OKHSL", matching
// ColorModeType MODE_RGB=0, MODE_HSV=1, MODE_LINEAR=2 (MODE_RAW=2 is a
// deprecated alias for the same value, color_picker.h:105-107), MODE_OKHSL=3.
const COLOR_MODE = {
  0: 'MODE_RGB',
  1: 'MODE_HSV',
  2: 'MODE_LINEAR',
  3: 'MODE_OKHSL',
};

// color_picker.cpp:1998, PROPERTY_HINT_ENUM "HSV Rectangle,HSV Rectangle
// Wheel,VHS Circle,OKHSL Circle,OK HS Rectangle:5,OK HL Rectangle,None:4":
// the `:5`/`:4` suffixes reassign those two entries, so by VALUE the hint
// covers 0-6 contiguously and matches PickerShapeType SHAPE_HSV_RECTANGLE=0
// through SHAPE_OK_HL_RECTANGLE=6 (color_picker.h:113-122) exactly.
const PICKER_SHAPE = {
  0: 'SHAPE_HSV_RECTANGLE',
  1: 'SHAPE_HSV_WHEEL',
  2: 'SHAPE_VHS_CIRCLE',
  3: 'SHAPE_OKHSL_CIRCLE',
  4: 'SHAPE_NONE',
  5: 'SHAPE_OK_HS_RECTANGLE',
  6: 'SHAPE_OK_HL_RECTANGLE',
};

validatorRegistry.registerAll('ColorPicker', {
  // color_picker.cpp:1993. set_pick_color delegates to _set_pick_color
  // (color_picker.cpp:324-340), a bare assignment with no clamp.
  color: v.color('color'),
  // color_picker.cpp:1994. set_edit_alpha (color_picker.cpp:359-372) is a
  // bare bool assignment.
  edit_alpha: v.boolean('edit_alpha'),
  // color_picker.cpp:1995. set_edit_intensity (color_picker.cpp:378-393) is a
  // bare bool assignment (it recomputes derived state, but never refuses).
  edit_intensity: v.boolean('edit_intensity'),
  // color_picker.cpp:1996. set_color_mode (color_picker.cpp:1242-1243)
  // ERR_FAIL_INDEXes on MODE_MAX before assigning.
  color_mode: v.enumInt('color_mode', 0, 3, COLOR_MODE, { enforced: 'color_picker.cpp:1243' }),
  // color_picker.cpp:1997. set_deferred_mode (color_picker.cpp:1311-1313) is
  // a bare bool assignment.
  deferred_mode: v.boolean('deferred_mode'),
  // color_picker.cpp:1998. set_picker_shape (color_picker.cpp:853-854)
  // ERR_FAIL_INDEXes on SHAPE_MAX before assigning.
  picker_shape: v.enumInt('picker_shape', 0, 6, PICKER_SHAPE, {
    enforced: 'color_picker.cpp:854',
  }),
  // color_picker.cpp:1999. set_can_add_swatches (color_picker.cpp:1883-1895)
  // is a bare bool assignment.
  can_add_swatches: v.boolean('can_add_swatches'),
  // color_picker.cpp:2001. set_sampler_visible (color_picker.cpp:1925-1932)
  // is a bare bool assignment.
  sampler_visible: v.boolean('sampler_visible'),
  // color_picker.cpp:2002. set_modes_visible (color_picker.cpp:1913-1920) is
  // a bare bool assignment.
  color_modes_visible: v.boolean('color_modes_visible'),
  // color_picker.cpp:2003. set_sliders_visible (color_picker.cpp:1937-1944)
  // is a bare bool assignment.
  sliders_visible: v.boolean('sliders_visible'),
  // color_picker.cpp:2004. set_hex_visible (color_picker.cpp:1949-1956) is a
  // bare bool assignment.
  hex_visible: v.boolean('hex_visible'),
  // color_picker.cpp:2005. set_presets_visible (color_picker.cpp:1901-1908)
  // is a bare bool assignment.
  presets_visible: v.boolean('presets_visible'),
});
