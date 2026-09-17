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
by `max_columns`/`same_column_width`/`fixed_column_width`/`icon_mode`, with a disabled
row's icon and text dimmed, plus a row/column guide line at every packed separator
outside TOP icon mode. A right-to-left list mirrors each row's icon inside the list's own
width and re-derives its label's pen, which lands a different distance from the icon than
the left-to-right pen does. No row is ever drawn selected, hovered, or under a cursor
highlight: `selected`, the current index, and a live hover/focus state are never part of
a `.tscn` in the first place.

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
| `items` | Array literal ([...]) |  |
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
`item_N/selectable`/`item_N/disabled` family, clamped to `item_count` rows — a
`PropertyListHelper` write past that count is a value Godot itself drops
(`ERR_FAIL_INDEX`), so this parser drops it too rather than substituting anything.
`valid-itemlist-properties` warns when an `item_<N>/` index reaches past `item_count`,
since Godot then drops the value with nothing logged. The deprecated compatibility
`items = [text, icon, disabled, …]` array (`ItemList::_set`, `item_list.cpp:2242-2259`)
is also read, but only for a file that carries NO `item_count` at all: Godot's own
saver never writes both forms in one file (the array predates the
`PropertyListHelper` family entirely), so a file that somehow carries both is
read as `item_count`/`item_N/*` only. A wrong arity (`arr.size() % 3 != 0`)
yields no rows, matching Godot's own `ERR_FAIL_COND_V` before `clear()` runs.

## Known limitations

- **Not drawn** The scroll-hint icon (`scroll_hint_mode`) — its TOP condition
  (`v_scroll_value > 1`) needs a live scrolled position no static file has, and
  is not vendored here.
- **Not drawn** The `focus` StyleBox, and every selected/hovered/cursor row background —
  none is ever reachable from a static file (`selected`, the current index and hover/focus
  are not `.tscn` properties).
- **Not drawn** `custom_bg_color`/`custom_fg_color`/`icon_modulate`/`icon_region`/
  `icon_transposed` are real `Item` members, but none is a `PropertyListHelper`-registered
  leaf, so none can ever be authored in a `.tscn` either — this previewer's own render is
  therefore complete for what the file can say, not a gap.
- **Approximated** A TOP-icon-mode, multi-line label wraps at word boundaries only. Godot
  also falls back to a mid-word (grapheme) break when a single word overflows its column;
  this previewer's shared text engine has no such combined mode, so an unbreakable long
  word overflows here instead.
- **Approximated** A row's text shapes once, at the SAME width `auto_width`/`auto_height`
  sizing uses. A `same_column_width`/dynamically-fit column whose final width differs from
  that (rather than being pinned by `fixed_column_width`) draws the same glyphs Godot would
  re-wrap at the final width.
- **Approximated** `max_text_lines` sizes a row's reserved text height but does not cap the
  number of wrapped lines actually drawn — a paragraph that wraps past it keeps every line
  instead of the tail collapsing into an enforced ellipsis on the last visible one.
- **Approximated** Right-to-left SHAPING. `_shape_text` hands `is_layout_rtl()` to the
  TextServer as each item's paragraph direction (`item_list.cpp:41-45`), and this
  previewer has no bidi pass, so a right-to-left script draws in logical order. Every
  LAYOUT branch of the flag is ported.
- **Not drawn** Both scrollbars. A right-to-left list moves the vertical one to the
  leading edge, which shifts every row guide line by its width
  (`item_list.cpp:1454-1458`) and takes the same width off the packing `fit_size`
  (`:1862-1864`); with no scrollbar drawn, neither applies.
- **Approximated** A TOP-mode line WIDER than its own box. Godot's CENTER alignment falls
  back to `width - line_width` once the paragraph direction is right-to-left
  (`text_paragraph.cpp:907-914`), pulling the line to the trailing edge, where this
  previewer leaves it at the box origin. Only the word-break bullet above reaches that
  case, and it already makes such a line's width wrong.
- **Needs runtime** Godot's right-to-left arms of `get_item_at_position`
  (`item_list.cpp:1975,1986`) and `is_pos_at_end_of_items` (`:2021-2023`) answer mouse
  hits under a live cursor, which a static preview has none of.
- **Approximated** `text_overrun_behavior` trims each row against the SAME width the
  minimum-size pass shaped at (`fixed_column_width`, or unconstrained when unset) — the
  same "shape once" scope this sheet's `same_column_width`/dynamically-fit-column bullet
  already names, so a row narrower than that at draw time is not re-trimmed to its own
  final width.
