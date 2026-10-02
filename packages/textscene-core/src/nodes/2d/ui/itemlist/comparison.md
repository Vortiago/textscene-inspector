---
type: ItemList
category: 2D
status: unreviewed
fixture: unit-item-list.tscn
# image: unit-item-list
renders_as: a panel StyleBox plus a packed grid of icon/label rows
---

# ItemList

ItemList is a scrollable list of selectable rows, each an optional icon and a label, in
one or more columns. The previewer draws the panel and every row's icon and text, packed
by `max_columns`/`same_column_width`/`fixed_column_width`/`icon_mode`. A disabled row's
icon and text are dimmed. Outside TOP icon mode, a row or column guide line marks every
packed separator. A right-to-left list mirrors each row's icon inside the list's width.
Its label's pen is re-derived and lands at a different distance from the icon than the
left-to-right pen.

No row is drawn selected, hovered or under a cursor highlight. `selected`, the current
index and a live hover or focus state are never part of a `.tscn`.

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
| `items` | Array literal ([...] or Array[T]([...])) |  |
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
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-itemlist-properties` (type-family match) | `itemlist-item-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser reads every property above and the `item_N/text`/`item_N/icon`/
`item_N/selectable`/`item_N/disabled` family, clamped to `item_count` rows. Godot drops
a `PropertyListHelper` write past that count (`ERR_FAIL_INDEX`), so this parser drops it
too and substitutes nothing. `valid-itemlist-properties` warns when an `item_<N>/` index
reaches past `item_count`, since Godot then drops the value and logs nothing.

The parser also reads the deprecated `items = [text, icon, disabled, …]` array
(`ItemList::_set`, `item_list.cpp:2242-2259`), but only for a file with no `item_count`.
Godot's saver never writes both forms in one file, because the array predates the
`PropertyListHelper` family. So a file that carries both is read as
`item_count`/`item_N/*` only. A wrong arity (`arr.size() % 3 != 0`) yields no rows, as
Godot's `ERR_FAIL_COND_V` does before `clear()` runs.

## Known limitations

- **Not drawn** The scroll-hint icon (`scroll_hint_mode`), which needs a live scroll
  position that no static file has.
- **Not drawn** The `focus` StyleBox and every selected, hovered or cursor row
  background, since hover, focus, `selected` and the current index are not `.tscn`
  properties.
- **Not drawn** `custom_bg_color`/`custom_fg_color`/`icon_modulate`/`icon_region`/
  `icon_transposed` are real `Item` members that a `.tscn` cannot author, since none is a
  `PropertyListHelper`-registered leaf.
- **Approximated** A TOP-icon-mode, multi-line label wraps at word boundaries only, so a
  long word overflows its column where Godot breaks it mid-word.
- **Approximated** A row's text is shaped once, at its `auto_width`/`auto_height` width,
  so a column of another width keeps lines that Godot re-wraps.
- **Approximated** `max_text_lines` reserves a row's text height but does not cap its
  lines, where Godot collapses the tail into an ellipsis on the last visible line.
- **Approximated** A right-to-left script draws in logical order, since the previewer has
  no bidirectional pass, though every layout branch of `is_layout_rtl()` is ported.
- **Not drawn** Both scrollbars, along with the row-guide shift and narrower packing that
  a right-to-left vertical scrollbar causes (`item_list.cpp:1454-1458`, `:1862-1864`).
- **Approximated** A right-to-left, CENTER-aligned TOP-mode line wider than its box stays
  at the box origin, where Godot pulls it to the trailing edge
  (`text_paragraph.cpp:907-914`).
- **Needs runtime** The right-to-left arms of `get_item_at_position`
  (`item_list.cpp:1975,1986`) and `is_pos_at_end_of_items` (`:2021-2023`) answer mouse
  hits under a live cursor, which a static preview does not have.
- **Approximated** `text_overrun_behavior` trims each row at its minimum-size width
  (`fixed_column_width`, or unconstrained when unset), so a row narrower at draw time is
  not re-trimmed.
