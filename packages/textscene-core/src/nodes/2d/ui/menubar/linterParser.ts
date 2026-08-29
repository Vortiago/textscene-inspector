/**
 * MenuBar strict validators for linting.
 *
 * Declare only MenuBar's OWN members: the ones doc/classes/MenuBar.xml lists
 * without an `overrides=` attribute. Everything from Control up is registered
 * on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `focus_mode` is skipped for exactly that reason: doc/classes/MenuBar.xml:103
 * carries `overrides="Control"`, MenuBar only changes the default to
 * FOCUS_ALL(3), and `_bind_methods` (menu_bar.cpp:717-758) never re-declares it
 * with an `ADD_PROPERTY`, so the validator belongs to Control.
 *
 * The other six are the whole ADD_PROPERTY list (menu_bar.cpp:751-758). All six
 * carry a real setter name, none is PROPERTY_USAGE_NONE, so all six can reach a
 * `.tscn`. MenuBar has no PropertyListHelper and no `_set`/`_get`: the per-menu
 * title, tooltip, disabled and hidden state live only in methods
 * (menu_bar.cpp:737-747) and in `menu_cache`, which is rebuilt from the
 * PopupMenu children rather than serialised, so there is no `menu_0/...`
 * indexed family to validate.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { TEXT_DIRECTION } from '../../../../linter/validators/textServerEnums.js';

validatorRegistry.registerAll('MenuBar', {
  // menu_bar.cpp:751 `PropertyInfo(Variant::BOOL, "flat")`, no hint.
  // set_flat (menu_bar.cpp:825-830) assigns and queues a redraw, nothing else.
  flat: v.boolean('flat'),
  // menu_bar.cpp:752 `PropertyInfo(Variant::INT, "start_index")` with
  // PROPERTY_HINT_NONE: both ends open, so ADR-0032's third tier applies and
  // there is no bound to check. set_start_index (menu_bar.cpp:836-844) assigns
  // straight through; bind_global_menu's `if (start_index >= 0)`
  // (menu_bar.cpp:229) only selects a placement strategy, it never rejects or
  // rewrites the stored value. `lenientInt`, since `strictInt`'s narrowed read
  // exists to feed a bound and there is none: a fractional literal is the
  // truncation warning every int slot shares, not a format error.
  start_index: v.lenientInt('start_index'),
  // menu_bar.cpp:753 `PropertyInfo(Variant::BOOL, "switch_on_hover")`, no hint.
  // set_switch_on_hover (menu_bar.cpp:788-790) is a bare assignment.
  switch_on_hover: v.boolean('switch_on_hover'),
  // menu_bar.cpp:754 `PropertyInfo(Variant::BOOL, "prefer_global_menu")`, no hint.
  // set_prefer_global_menu (menu_bar.cpp:850-859) binds or unbinds the native
  // menu but refuses nothing.
  prefer_global_menu: v.boolean('prefer_global_menu'),
  // menu_bar.cpp:757 PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited",
  // four labels covering 0..3. The bound is the SETTER's, not the hint's:
  // set_text_direction (menu_bar.cpp:801) is
  // `ERR_FAIL_COND((int)p_text_direction < -1 || (int)p_text_direction > 3)`,
  // so -1 is engine-legal while the hint never offers it, and anything outside
  // [-1, 3] is refused outright. Button re-declares the property with the
  // byte-identical guard (button.cpp:637), which is why the two slices agree.
  text_direction: v.enumInt('text_direction', 0, 3, TEXT_DIRECTION, {
    hinted: 'menu_bar.cpp:757',
    enforced: 'menu_bar.cpp:801',
    enforcedMin: { at: -1 },
  }),
  // menu_bar.cpp:758 PROPERTY_HINT_LOCALE_ID with an empty hint string: the hint
  // drives an inspector dropdown, it states no bound. set_language
  // (menu_bar.cpp:813-819) accepts any string, so this is format only.
  language: v.quotedString('language'),
});
