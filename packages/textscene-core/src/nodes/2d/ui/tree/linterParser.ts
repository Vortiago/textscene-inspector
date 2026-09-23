/**
 * Tree strict validators: only the members doc/classes/Tree.xml lists without `overrides=`,
 * since the base-walk delivers the rest. No `item_N/...` family, unlike ItemList: a `TreeItem` is
 * a plain Object, not a Node, so rows, cells, icons and fold state never reach a `.tscn`.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../../../linter/validators/index.js';

/**
 * `Tree::set_drop_mode_flags` (tree.cpp:6653-6663) stores `p_flags` with no mask, so a bit
 * outside the hint is kept but not offered: `hintedBitField`'s warning (ADR-0032), not
 * `maskedBitField`'s error. The hint at tree.cpp:6816 is DROP_MODE_ON_ITEM=1 and
 * DROP_MODE_INBETWEEN=2 (tree.h:464-466). DROP_MODE_DISABLED is 0, the empty set.
 */
const dropModeFlagsValidator = hintedBitField('drop_mode_flags', {
  hinted: 'tree.cpp:6816',
  labels: { 1: 'DROP_MODE_ON_ITEM', 2: 'DROP_MODE_INBETWEEN' },
});

validatorRegistry.registerAll('Tree', {
  // tree.cpp:6807: a bare `PropertyInfo(Variant::INT, "columns")`, no hint, so the
  // ceiling is open. `Tree::set_columns` refuses `p_columns < 1` (tree.cpp:5716).
  columns: v.int('columns', { min: 1, enforced: { min: 'tree.cpp:5716' } }),
  // tree.cpp:6808
  column_titles_visible: v.boolean('column_titles_visible'),
  // tree.cpp:6809
  allow_reselect: v.boolean('allow_reselect'),
  // tree.cpp:6810
  allow_rmb_select: v.boolean('allow_rmb_select'),
  // tree.cpp:6811
  allow_search: v.boolean('allow_search'),
  // tree.cpp:6812
  hide_folding: v.boolean('hide_folding'),
  // tree.cpp:6813
  enable_recursive_folding: v.boolean('enable_recursive_folding'),
  // tree.cpp:6814
  enable_drag_unfolding: v.boolean('enable_drag_unfolding'),
  // tree.cpp:6815
  hide_root: v.boolean('hide_root'),
  drop_mode_flags: dropModeFlagsValidator,
  // tree.cpp:6817: PROPERTY_HINT_ENUM "Single,Row,Multi", SELECT_SINGLE=0 to SELECT_MULTI=2
  // (tree.cpp:6841-6843, tree.h:457-461). `Tree::set_select_mode` (tree.cpp:5403-5405) has no
  // ERR_FAIL or clamp, so out of range only warns.
  select_mode: v.enumInt(
    'select_mode',
    0,
    2,
    { 0: 'SELECT_SINGLE', 1: 'SELECT_ROW', 2: 'SELECT_MULTI' },
    { hinted: 'tree.cpp:6817' }
  ),
  // tree.cpp:6818
  auto_tooltip: v.boolean('auto_tooltip'),

  // Scroll (ADD_GROUP "Scroll" with an empty prefix, tree.cpp:6819, so the keys
  // keep their full names). tree.cpp:6820
  scroll_horizontal_enabled: v.boolean('scroll_horizontal_enabled'),
  // tree.cpp:6821
  scroll_vertical_enabled: v.boolean('scroll_vertical_enabled'),
  // tree.cpp:6822: PROPERTY_HINT_ENUM "Disabled,Both,Top,Bottom", SCROLL_HINT_MODE_DISABLED=0 to
  // _BOTTOM=3 (tree.cpp:6849-6852, tree.h:469-474). `Tree::set_scroll_hint_mode`
  // (tree.cpp:6086-6093) rejects and clamps nothing, so the hint bounds the dropdown only.
  scroll_hint_mode: v.enumInt(
    'scroll_hint_mode',
    0,
    3,
    {
      0: 'SCROLL_HINT_MODE_DISABLED',
      1: 'SCROLL_HINT_MODE_BOTH',
      2: 'SCROLL_HINT_MODE_TOP',
      3: 'SCROLL_HINT_MODE_BOTTOM',
    },
    { hinted: 'tree.cpp:6822' }
  ),
  // tree.cpp:6823
  tile_scroll_hint: v.boolean('tile_scroll_hint'),
});
