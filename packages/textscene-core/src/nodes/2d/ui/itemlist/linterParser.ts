/**
 * ItemList strict validators for linting.
 *
 * Declare only ItemList's OWN members: the ones doc/classes/ItemList.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `clip_contents` and `focus_mode` both carry `overrides="Control"` (ItemList's
 * constructor only changes their defaults), so they stay on Control.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { OVERRUN_BEHAVIOR } from '../../../../linter/validators/textServerEnums.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/** `ItemList::SelectMode`, item_list.h:48-50, in declaration order. */
const SELECT_MODE = {
  0: 'SELECT_SINGLE',
  1: 'SELECT_MULTI',
  2: 'SELECT_TOGGLE',
};

/** `ItemList::IconMode`, item_list.h:43-44, in declaration order. */
const ICON_MODE = {
  0: 'ICON_MODE_TOP',
  1: 'ICON_MODE_LEFT',
};

/** `ItemList::ScrollHintMode`, item_list.h:54-57, in declaration order. */
const SCROLL_HINT_MODE = {
  0: 'SCROLL_HINT_MODE_DISABLED',
  1: 'SCROLL_HINT_MODE_BOTH',
  2: 'SCROLL_HINT_MODE_TOP',
  3: 'SCROLL_HINT_MODE_BOTTOM',
};

/**
 * `item_<idx>/<leaf>` leaves, keyed by leaf name: the four properties
 * `base_property_helper.register_property` adds (item_list.cpp:2463-2466). They
 * are not `ADD_PROPERTY` calls and appear nowhere in `_bind_methods`'s property
 * block; ItemList delegates `_set`/`_get`/`_get_property_list` to the helper
 * (item_list.h, the `property_helper` forwards), so this family is only visible
 * by reading the helper setup.
 *
 * Every leaf setter is reached through `PropertyListHelper::_call_setter`, which
 * forwards `(index, value)` to the bound method, and all four ItemList setters
 * are bare assignments past an `ERR_FAIL_INDEX` on the index (an array-bounds
 * guard, not a value bound). So no leaf carries a magnitude bound.
 *
 * The setters themselves fold a negative index from the end (`p_idx +=
 * get_item_count()`), but a `.tscn` never reaches that: the helper refuses to
 * resolve a negative index first (property_list_helper.cpp:58), so the
 * end-relative form is a GDScript convenience only, and that line, not any
 * setter, is what grounds the dispatcher's negative-index error below.
 */
const ITEM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // item_list.cpp:2463, Variant::STRING, no hint. set_item_text
  // (item_list.cpp:89-105) assigns past the index guard.
  text: v.quotedString('text'),
  // item_list.cpp:2464, Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE
  // "Texture2D". set_item_icon (item_list.cpp:206-228) assigns past the index
  // guard. No PROPERTY_USAGE_STORE_IF_NULL, so an unset icon is omitted from
  // the file rather than written as null.
  icon: v.resourceReference('icon'),
  // item_list.cpp:2465, Variant::BOOL, no hint. set_item_selectable
  // (item_list.cpp:368-376) assigns past the index guard. Defaults to true, so
  // it is only ever written when an item is made unselectable.
  selectable: v.boolean('selectable'),
  // item_list.cpp:2466, Variant::BOOL, no hint. set_item_disabled
  // (item_list.cpp:384-397) assigns past the index guard.
  disabled: v.boolean('disabled'),
};

const itemValidator = indexedFamilyValidator({
  prefix: 'item_',
  leaves: ITEM_LEAVES,
  unknownCode: 'INVALID_ITEM_KEY',
  describes: 'item_<index>/<leaf> (see item_list.cpp, PropertyListHelper-backed)',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_ITEM_INDEX',
    message: (index) =>
      `Item index ${index} must be non-negative. ItemList's property helper refuses a negative index (property_list_helper.cpp:58), so this property is never applied`,
  },
});

validatorRegistry.registerAll('ItemList', {
  // item_list.cpp:2393, Variant::BOOL, no hint. set_allow_reselect
  // (item_list.cpp:2081-2083) is a bare assignment.
  allow_reselect: v.boolean('allow_reselect'),
  // item_list.cpp:2394, Variant::BOOL, no hint. set_allow_rmb_select
  // (item_list.cpp:2073-2075) is a bare assignment.
  allow_rmb_select: v.boolean('allow_rmb_select'),
  // item_list.cpp:2395, Variant::BOOL, no hint. set_allow_search
  // (item_list.cpp:2089-2091) is a bare assignment.
  allow_search: v.boolean('allow_search'),
  // item_list.cpp:2397, Variant::BOOL, no hint. set_auto_width
  // (item_list.cpp:2152-2161) assigns past an equality early-out.
  auto_width: v.boolean('auto_width'),
  // item_list.cpp:2398, Variant::BOOL, no hint. set_auto_height
  // (item_list.cpp:2167-2176) assigns past an equality early-out.
  auto_height: v.boolean('auto_height'),
  // item_list.cpp:2400, Variant::BOOL, no hint. set_wraparound_items
  // (item_list.cpp:2197-2205) assigns past an equality early-out.
  wraparound_items: v.boolean('wraparound_items'),
  // item_list.cpp:2402, Variant::BOOL, no hint. set_tile_scroll_hint
  // (item_list.cpp:2224-2231) assigns past an equality early-out.
  tile_scroll_hint: v.boolean('tile_scroll_hint'),
  // item_list.cpp:2406, Variant::BOOL, no hint. set_same_column_width
  // (item_list.cpp:604-612) assigns past an equality early-out.
  same_column_width: v.boolean('same_column_width'),

  // item_list.cpp:2392, PROPERTY_HINT_ENUM "Single,Multi,Toggle" (0-2).
  // set_select_mode (item_list.cpp:657-665) assigns past an equality early-out
  // with no ERR_FAIL, so the hint constrains the inspector widget only: hinted.
  select_mode: v.enumInt('select_mode', 0, 2, SELECT_MODE, {
    hinted: 'item_list.cpp:2392',
  }),
  // item_list.cpp:2399, PROPERTY_HINT_ENUM with 7 entries (0-6).
  // set_text_overrun_behavior (item_list.cpp:2182-2191) assigns straight
  // through, so both ends are hinted.
  text_overrun_behavior: v.enumInt('text_overrun_behavior', 0, 6, OVERRUN_BEHAVIOR, {
    hinted: 'item_list.cpp:2399',
  }),
  // item_list.cpp:2401, PROPERTY_HINT_ENUM "Disabled,Both,Top,Bottom" (0-3).
  // set_scroll_hint_mode (item_list.cpp:2211-2218) assigns straight through.
  scroll_hint_mode: v.enumInt('scroll_hint_mode', 0, 3, SCROLL_HINT_MODE, {
    hinted: 'item_list.cpp:2401',
  }),
  // item_list.cpp:2409, PROPERTY_HINT_ENUM "Top,Left" (0-1). Unlike the three
  // enums above, set_icon_mode opens with ERR_FAIL_INDEX((int)p_mode, 2)
  // (item_list.cpp:672), which drops the write entirely: enforced, not hinted.
  icon_mode: v.enumInt('icon_mode', 0, 1, ICON_MODE, {
    enforced: 'item_list.cpp:672',
  }),

  // item_list.cpp:2396, PROPERTY_HINT_RANGE "1,10,1,or_greater". The trailing
  // `or_greater` opens the max end, so the hinted 10 is not a bound; the floor
  // is ERR_FAIL_COND(p_lines < 1) at item_list.cpp:619, which drops the write.
  max_text_lines: v.int('max_text_lines', { min: 1, enforced: 'item_list.cpp:619' }),
  // item_list.cpp:2403, ADD_ARRAY_COUNT, which binds PROPERTY_HINT_NONE with no
  // hint string at all (class_db.cpp:1492). set_item_count opens with
  // ERR_FAIL_COND(p_count < 0) at item_list.cpp:527; there is no ceiling.
  item_count: v.int('item_count', { min: 0, enforced: 'item_list.cpp:527' }),
  // item_list.cpp:2405, PROPERTY_HINT_RANGE "0,10,1,or_greater", max end open.
  // ERR_FAIL_COND(p_amount < 0) at item_list.cpp:641. 0 is the legal "as many
  // columns as fit" value, not a missing setting.
  max_columns: v.int('max_columns', { min: 0, enforced: 'item_list.cpp:641' }),
  // item_list.cpp:2407, PROPERTY_HINT_RANGE "0,100,1,or_greater,suffix:px",
  // max end open. ERR_FAIL_COND(p_size < 0) at item_list.cpp:589.
  fixed_column_width: v.int('fixed_column_width', { min: 0, enforced: 'item_list.cpp:589' }),
  // item_list.cpp:2410, Variant::FLOAT with PROPERTY_HINT_NONE: no range in the
  // hint and none in the setter, so a negative or fractional scale is stored as
  // written. The one guard is ERR_FAIL_COND(!Math::is_finite(p_scale)) at
  // item_list.cpp:2098, and `inf` / `inf_neg` / `nan` are exactly the spellings
  // the unbounded numeric check already refuses, so no extra bound is needed.
  icon_scale: v.float('icon_scale'),
  // item_list.cpp:2411, Variant::VECTOR2I, PROPERTY_HINT_NONE ("suffix:px" only).
  // set_fixed_icon_size (item_list.cpp:691-699) assigns past an equality
  // early-out, so neither component has a floor: shape only.
  fixed_icon_size: v.vector2i('fixed_icon_size'),

  // `PropertyListHelper` names each leaf `vformat("%s%d/%s", prefix, i, name)`
  // (property_list_helper.cpp:149), gluing the index straight onto the `item_`
  // prefix, so the registry matches it under `item_#/*` rather than `item_/*`.
  'item_#/*': itemValidator,
});
