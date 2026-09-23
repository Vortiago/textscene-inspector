/**
 * MenuBar's strict validators: the six ADD_PROPERTY calls of menu_bar.cpp:751-758, which doc/classes/MenuBar.xml lists without `overrides=`. `focus_mode`
 * (doc/classes/MenuBar.xml:103, `overrides="Control"`) only changes a default to FOCUS_ALL(3), and
 * `_bind_methods` (menu_bar.cpp:717-758) never re-declares it. With no PropertyListHelper or `_set`/`_get`,
 * per-menu state lives in methods (menu_bar.cpp:737-747) and `menu_cache`, so no `menu_0/...` family is saved.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { TEXT_DIRECTION } from '../../../../linter/validators/textServerEnums.js';

validatorRegistry.registerAll('MenuBar', {
  // menu_bar.cpp:751 `PropertyInfo(Variant::BOOL, "flat")`, no hint.
  // set_flat (menu_bar.cpp:825-830) assigns and queues a redraw, nothing else.
  flat: v.boolean('flat'),
  // menu_bar.cpp:752 `PropertyInfo(Variant::INT, "start_index")`, PROPERTY_HINT_NONE: no bound (ADR-0032).
  // set_start_index (menu_bar.cpp:836-844) assigns straight through, and `if (start_index >= 0)`
  // (menu_bar.cpp:229) only picks a placement. `lenientInt`, since `strictInt` feeds a bound: a
  // fractional literal gets the shared truncation warning, not a format error.
  start_index: v.lenientInt('start_index'),
  // menu_bar.cpp:753 `PropertyInfo(Variant::BOOL, "switch_on_hover")`, no hint.
  // set_switch_on_hover (menu_bar.cpp:788-790) is a bare assignment.
  switch_on_hover: v.boolean('switch_on_hover'),
  // menu_bar.cpp:754 `PropertyInfo(Variant::BOOL, "prefer_global_menu")`, no hint.
  // set_prefer_global_menu (menu_bar.cpp:850-859) binds or unbinds the native menu but refuses
  // nothing.
  prefer_global_menu: v.boolean('prefer_global_menu'),
  // menu_bar.cpp:757 PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited", 0..3. The setter
  // (menu_bar.cpp:801) enforces `ERR_FAIL_COND((int)p_text_direction < -1 || (int)p_text_direction > 3)`,
  // so -1 is legal although the hint never offers it. Button carries the same guard (button.cpp:637).
  text_direction: v.enumInt('text_direction', 0, 3, TEXT_DIRECTION, {
    hinted: 'menu_bar.cpp:757',
    enforced: 'menu_bar.cpp:801',
    enforcedMin: { at: -1 },
  }),
  // menu_bar.cpp:758 PROPERTY_HINT_LOCALE_ID with an empty hint string drives an inspector dropdown
  // and states no bound. set_language (menu_bar.cpp:813-819) accepts any string: format only.
  language: v.quotedString('language'),
});
