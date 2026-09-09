---
type: ItemList
category: 2D
status: unimplemented
fixture: unit-item-list.tscn
# image: unit-item-list
renders_as: invisible transform-only fallback
---

# ItemList

ItemList is a scrollable list of selectable rows, each an optional icon and a label, in
one or more columns. The previewer parses and validates it but does not draw it, so it
renders as a transform-only fallback and its children still show.

## Linting

<!-- lint:begin ItemList -->
Strict parsing format-checks these `ItemList` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `allow_reselect` | true or false |  |
| `allow_rmb_select` | true or false |  |
| `allow_search` | true or false |  |
| `auto_height` | true or false |  |
| `auto_width` | true or false |  |
| `fixed_column_width` | integer >= 0 | error below |
| `fixed_icon_size` | Vector2i(x, y), or the Vector2 spelling Godot converts |  |
| `icon_mode` | enum 0-1 (ICON_MODE_TOP/ICON_MODE_LEFT) | error |
| `icon_scale` | float |  |
| `item_#/*` | item_<index>/<leaf> (see item_list.cpp, PropertyListHelper-backed) |  |
| `item_count` | integer >= 0 | error below |
| `max_columns` | integer >= 0 | error below |
| `max_text_lines` | integer >= 1 | error below |
| `same_column_width` | true or false |  |
| `scroll_hint_mode` | enum 0-3 (SCROLL_HINT_MODE_DISABLED/SCROLL_HINT_MODE_BOTH/SCROLL_HINT_MODE_TOP/SCROLL_HINT_MODE_BOTTOM) | warning |
| `select_mode` | enum 0-2 (SELECT_SINGLE/SELECT_MULTI/SELECT_TOGGLE) | warning |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) | warning |
| `tile_scroll_hint` | true or false |  |
| `wraparound_items` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-itemlist-properties` (type-family match) | `itemlist-item-index-out-of-range` | error |
<!-- lint:end -->

Every ItemList key strict rejects, the lenient parser also never reads, so nothing is
substituted. `valid-itemlist-properties` warns when an `item_<N>/` index reaches past
`item_count`, since Godot then drops the value with nothing logged.

## Known limitations

- **Not drawn** Godot draws the rows, icons and panel. The previewer draws nothing for
  this node.
