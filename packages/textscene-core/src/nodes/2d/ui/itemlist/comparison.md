---
type: ItemList
category: 2D
status: unimplemented
fixture: unit-item-list.tscn
# image: unit-item-list
renders_as: invisible transform-only fallback
---

# ItemList

A scrollable Control that draws a list of selectable rows, each an optional
Texture2D icon plus a text label, laid out in one or more columns inside a panel
StyleBox; the previewer parses and validates it but does not draw it yet, so it
renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `select_mode` | `1` | `SELECT_MULTI`: more than one row can be selected at once. |
| `allow_reselect` | `true` | Re-emits `item_selected` when an already-selected row is clicked. |
| `allow_rmb_select` | `true` | A right click also changes the selection. |
| `allow_search` | `false` | Turns off type-to-jump keyboard search. |
| `max_text_lines` | `2` | Each label may wrap to two lines. Only takes effect while `icon_mode` is `ICON_MODE_TOP` (item_list.cpp:623). |
| `auto_width` | `true` | The list asks for the width its widest row needs. |
| `auto_height` | `true` | The list asks for the height its rows need. |
| `text_overrun_behavior` | `1` | `OVERRUN_TRIM_CHAR`: an over-long label is cut mid-character. |
| `wraparound_items` | `false` | Arrow-key navigation stops at the ends instead of wrapping. |
| `scroll_hint_mode` | `2` | `SCROLL_HINT_MODE_TOP`: draws the scroll-hint icon at the top edge only. |
| `tile_scroll_hint` | `true` | Tiles that hint texture across the edge rather than stretching it. |
| `max_columns` | `2` | At most two columns; `0` would mean "as many as fit". |
| `same_column_width` | `true` | Every column takes the width of the widest. |
| `fixed_column_width` | `96` | Pins each column to 96px instead of measuring content. |
| `icon_mode` | `0` | `ICON_MODE_TOP`: the icon sits above its label rather than left of it. |
| `icon_scale` | `1.5` | Draws each icon at 150% of its texture size. |
| `fixed_icon_size` | `Vector2i(24, 24)` | Forces every icon into a 24x24 box before `icon_scale`. |
| `item_count` | `3` | Sizes the item array; the `item_<N>/…` keys below only resolve within it. |
| `item_0/text`, `item_1/text`, `item_2/text` | `"Sword"`, `"Shield"`, `"Potion"` | The three row labels. |
| `item_0/icon` | `ExtResource("1_icon")` | A Texture2D drawn for the first row. |
| `item_1/selectable` | `false` | Row 1 cannot be selected (it defaults to `true`). |
| `item_2/disabled` | `true` | Row 2 draws greyed out and takes no input. |

## Divergences

Nothing rendered yet, so there is no pixel divergence to record. What the
fixture does not exercise is the theme layer: the panel, focus, hovered,
selected and cursor StyleBoxes, the font and its four colours, and the
`h_separation` / `v_separation` / `line_separation` / `icon_margin` constants
(item_list.cpp:2431-2457) are `BIND_THEME_ITEM` bindings, not properties, so
they reach a scene as `theme_override_*` keys on Control rather than as
anything ItemList declares.

## Linting

<!-- lint:begin ItemList -->
Strict parsing format-checks these `ItemList` properties, plus 28 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `allow_reselect` | true or false |
| `allow_rmb_select` | true or false |
| `allow_search` | true or false |
| `auto_height` | true or false |
| `auto_width` | true or false |
| `fixed_column_width` | integer >= 0 |
| `fixed_icon_size` | Vector2i(x, y) |
| `icon_mode` | enum 0-1 (ICON_MODE_TOP/ICON_MODE_LEFT) |
| `icon_scale` | float |
| `item_#/*` | item_<index>/<leaf> (see item_list.cpp, PropertyListHelper-backed) |
| `item_count` | integer >= 0 |
| `max_columns` | integer >= 0 |
| `max_text_lines` | integer >= 1 |
| `same_column_width` | true or false |
| `scroll_hint_mode` | enum 0-3 (SCROLL_HINT_MODE_DISABLED/SCROLL_HINT_MODE_BOTH/SCROLL_HINT_MODE_TOP/SCROLL_HINT_MODE_BOTTOM) |
| `select_mode` | enum 0-2 (SELECT_SINGLE/SELECT_MULTI/SELECT_TOGGLE) |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) |
| `tile_scroll_hint` | true or false |
| `wraparound_items` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-itemlist-properties` (type-family match) | `itemlist-item-index-out-of-range` | warning |
<!-- lint:end -->

Every ItemList key the strict parser rejects, the lenient parser also cannot
use, so there is no substitution to document: nothing here has a renderer to
fall back for. The tiers split on where Godot draws the line. `icon_mode` errors
outside 0-1 because `set_icon_mode` opens with `ERR_FAIL_INDEX` and drops the
write (item_list.cpp:672), and `max_text_lines`, `item_count`, `max_columns` and
`fixed_column_width` error below their floors for the same reason. `select_mode`,
`scroll_hint_mode` and `text_overrun_behavior` only warn: their setters assign
whatever they are handed, so an out-of-range value is stored and merely
unreachable from the inspector. `icon_scale` and `fixed_icon_size` carry
`PROPERTY_HINT_NONE` and no setter guard beyond a non-finite refusal, so they
are checked for shape alone. The one semantic rule, `valid-itemlist-properties`,
warns when an `item_<N>/…` index reaches past `item_count`, because
`PropertyListHelper` then never resolves the key and the value is dropped with
nothing logged.
