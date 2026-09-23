---
type: Tree
category: 2D
status: unreviewed
fixture: unit-tree.tscn
# image: unit-tree
renders_as: an empty panel, with a blank header row when column_titles_visible
---

# Tree

Tree is the hierarchical multi-column list Control, built from TreeItem objects at
runtime. A `.tscn` Tree carries no `TreeItem`. The items and every column's title text
exist only when a script creates them. So the previewer draws only the `panel` StyleBox
and, when `column_titles_visible` is set, one blank-titled header cell per column. That
empty panel is the whole truth of such a scene, not a limitation. A
right-to-left Tree mirrors each header cell inside its own width (`tree.cpp:5158-5160`).

## Linting

<!-- lint:begin Tree -->
Strict parsing format-checks these `Tree` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `allow_reselect` | true or false |  |
| `allow_rmb_select` | true or false |  |
| `allow_search` | true or false |  |
| `auto_tooltip` | true or false |  |
| `column_titles_visible` | true or false |  |
| `columns` | integer >= 1 | error below |
| `drop_mode_flags` | bit mask of DROP_MODE_ON_ITEM (1) \| DROP_MODE_INBETWEEN (2) |  |
| `enable_drag_unfolding` | true or false |  |
| `enable_recursive_folding` | true or false |  |
| `hide_folding` | true or false |  |
| `hide_root` | true or false |  |
| `scroll_hint_mode` | enum 0-3 (SCROLL_HINT_MODE_DISABLED/SCROLL_HINT_MODE_BOTH/SCROLL_HINT_MODE_TOP/SCROLL_HINT_MODE_BOTTOM) | warning |
| `scroll_horizontal_enabled` | true or false |  |
| `scroll_vertical_enabled` | true or false |  |
| `select_mode` | enum 0-2 (SELECT_SINGLE/SELECT_ROW/SELECT_MULTI) | warning |
| `tile_scroll_hint` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all of Tree's own members. The registered lenient
parser reads only `columns` and `column_titles_visible`, the two this previewer's picture
depends on. A malformed `columns` reads as unset (1). The strict linter format-checks
every other property, and the previewer never reads it, since none changes what an
item-less Tree draws. A script creates the rows and cells, so they never reach the
`.tscn`.

## Known limitations

- **Not drawn** Godot draws the rows, columns and fold arrows. The previewer draws
  nothing for this node.
- **Approximated** Right-to-left shaping. Each column title's paragraph direction follows
  `is_layout_rtl()` (`tree.cpp:2155`), and this previewer has no bidi pass. No title is
  ever serialised, so the header cells are blank either way and nothing of it shows.
- **Needs runtime** Godot's right-to-left arms of `get_column_at_position`
  (`tree.cpp:6426`), `get_drop_section_at_position` (`:6458`), `get_item_at_position`
  (`:6508`) and `get_tooltip` (`:6568`) answer mouse hits, and `gui_input` swaps the
  `ui_left`/`ui_right` actions (`:3794,3812`). All of them need a live cursor or
  keyboard, and a static preview has neither.
