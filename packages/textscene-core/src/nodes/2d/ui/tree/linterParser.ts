/**
 * Tree strict validators for linting.
 *
 * Declare only Tree's OWN members, the ones doc/classes/Tree.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * No `item_N/...` family here, unlike ItemList: a `TreeItem` is a plain Object,
 * not a Node, so rows, cell text, icons and fold state are created by script at
 * runtime and never reach a `.tscn`.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { hintedBitField, v } from '../../../../linter/validators/index.js';

/**
 * `drop_mode_flags` is a `PROPERTY_HINT_FLAGS` field whose setter does NOT mask.
 *
 * `Tree::set_drop_mode_flags` (tree.cpp:6653-6663) stores `p_flags` verbatim;
 * there is no `p_flags & MASK`, and `get_drop_mode_flags` hands the wide value
 * straight back. So `maskedBitField` would be the wrong tool twice over: it
 * grounds itself `enforced` and reports an ERROR, and nothing here is enforced.
 * `hintedBitField` is that combinator's warning arm standing alone, which is
 * where ADR-0032 puts a bit the engine keeps and the inspector cannot offer.
 *
 * The hint at tree.cpp:6816 lists two entries, "On Item,In Between", i.e.
 * DROP_MODE_ON_ITEM=1 and DROP_MODE_INBETWEEN=2 (tree.h:464-466); DROP_MODE_DISABLED
 * is 0, the empty set, and not a bit of its own.
 */
const dropModeFlagsValidator = hintedBitField('drop_mode_flags', {
  hinted: 'tree.cpp:6816',
  labels: { 1: 'DROP_MODE_ON_ITEM', 2: 'DROP_MODE_INBETWEEN' },
});

validatorRegistry.registerAll('Tree', {
  // tree.cpp:6807: a bare `PropertyInfo(Variant::INT, "columns")`, no hint, so
  // the ceiling is open. The floor is enforced: `Tree::set_columns` opens with
  // `ERR_FAIL_COND(p_columns < 1)` (tree.cpp:5716), so a saved scene can never
  // carry 0 or a negative count.
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
  // tree.cpp:6817: PROPERTY_HINT_ENUM "Single,Row,Multi"; BIND_ENUM_CONSTANT
  // SELECT_SINGLE=0, SELECT_ROW=1, SELECT_MULTI=2 (tree.cpp:6841-6843, enum
  // declared tree.h:457-461). `Tree::set_select_mode` is a bare assignment
  // (tree.cpp:5403-5405) with no ERR_FAIL or clamp, so the three-entry hint
  // bounds the inspector dropdown only: out of range warns, never errors.
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
  // keep their full names).
  // tree.cpp:6820
  scroll_horizontal_enabled: v.boolean('scroll_horizontal_enabled'),
  // tree.cpp:6821
  scroll_vertical_enabled: v.boolean('scroll_vertical_enabled'),
  // tree.cpp:6822: PROPERTY_HINT_ENUM "Disabled,Both,Top,Bottom";
  // BIND_ENUM_CONSTANT SCROLL_HINT_MODE_DISABLED=0 .. _BOTTOM=3
  // (tree.cpp:6849-6852, enum declared tree.h:469-474).
  // `Tree::set_scroll_hint_mode` (tree.cpp:6086-6093) early-returns on an
  // unchanged value and then assigns; nothing rejects or clamps, so the hint
  // bounds the dropdown only.
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
