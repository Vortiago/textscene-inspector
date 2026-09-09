---
type: Tree
category: 2D
status: unimplemented
fixture: unit-tree.tscn
# image: unit-tree
renders_as: invisible transform-only fallback
---

# Tree

Tree is the hierarchical multi-column list Control, built from TreeItem objects at
runtime. The previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

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

`linterParser.ts` format-checks all 16 of Tree's own members. There is no `parser.ts`,
and `parseControl` reads none of these keys, so strict and lenient agree on every
property. Rows and cells are created by script and never reach the `.tscn`.

## Known limitations

- **Not drawn** Godot draws the rows, columns and fold arrows. The previewer draws
  nothing for this node.
