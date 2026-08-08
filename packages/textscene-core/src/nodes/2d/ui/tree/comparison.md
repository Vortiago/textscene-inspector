---
type: Tree
category: 2D
status: unimplemented
fixture: unit-tree.tscn
# image: unit-tree
renders_as: invisible transform-only fallback
---

# Tree

Tree is Godot's hierarchical multi-column list Control: a scrollable grid of rows built
from `TreeItem` objects, with fold arrows, optional column titles and per-cell widgets.
Controls render through the 2D DOM overlay (ADR-0003), and the previewer parses and
validates this node but does not draw it yet, so it renders as an invisible
transform-only fallback and its children still show.

## Properties exercised

| Group | Properties (fixture values) | Effect |
| --- | --- | --- |
| Columns | `columns` (`3`), `column_titles_visible` (`true`) | Format-checked only; the previewer draws nothing regardless. |
| Selection | `select_mode` (`2`, SELECT_MULTI), `allow_reselect`, `allow_rmb_select`, `allow_search` (`false`) | Format-checked only. |
| Folding | `hide_folding` (`true`), `enable_recursive_folding` (`false`), `enable_drag_unfolding` (`false`), `hide_root` (`true`) | Format-checked only. |
| Drag and drop | `drop_mode_flags` (`3`, ON_ITEM \| INBETWEEN) | Format-checked only. |
| Tooltips | `auto_tooltip` (`false`) | Format-checked only. |
| Scroll | `scroll_horizontal_enabled` (`false`), `scroll_vertical_enabled` (`false`), `scroll_hint_mode` (`1`, BOTH), `tile_scroll_hint` (`true`) | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin Tree -->
Strict parsing format-checks these `Tree` properties, plus 28 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `allow_reselect` | true or false |
| `allow_rmb_select` | true or false |
| `allow_search` | true or false |
| `auto_tooltip` | true or false |
| `column_titles_visible` | true or false |
| `columns` | integer >= 1 |
| `drop_mode_flags` | bit mask of DROP_MODE_ON_ITEM (1) | DROP_MODE_INBETWEEN (2) |
| `enable_drag_unfolding` | true or false |
| `enable_recursive_folding` | true or false |
| `hide_folding` | true or false |
| `hide_root` | true or false |
| `scroll_hint_mode` | enum 0-3 (SCROLL_HINT_MODE_DISABLED/SCROLL_HINT_MODE_BOTH/SCROLL_HINT_MODE_TOP/SCROLL_HINT_MODE_BOTTOM) |
| `scroll_horizontal_enabled` | true or false |
| `scroll_vertical_enabled` | true or false |
| `select_mode` | enum 0-2 (SELECT_SINGLE/SELECT_ROW/SELECT_MULTI) |
| `tile_scroll_hint` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all 16 of Tree's own members, which is every member in
`doc/classes/Tree.xml` except `clip_contents` and `focus_mode`, both `overrides="Control"`.
That count is far smaller than the class reads, because `TreeItem` is a plain Object
rather than a Node: rows, cell text, icons, per-column widths and fold state are created
by script at runtime and never reach the `.tscn`, so no amount of linting can see the
content a Tree will actually show. Three of the sixteen diagnose at warning rather than
error, `select_mode` and `scroll_hint_mode` past their last constant and
`drop_mode_flags` past its two hinted bits, because each setter stores the wide value
unaltered and only the inspector widget is narrow. None of the sixteen affects the
rendered fallback today, since Tree draws nothing: the strict and lenient parsers agree
on every property, because there is no `parser.ts` here at all and `parseControl` reads
none of these keys. A property here becomes render-relevant only once a concrete tree
view is drawn.
