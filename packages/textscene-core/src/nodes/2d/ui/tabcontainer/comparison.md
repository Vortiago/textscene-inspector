---
type: TabContainer
category: 2D
status: unreviewed
fixture: unit-tab-container.tscn
# image: unit-tab-container
renders_as: a panel StyleBox behind the current page, topped by an internal TabBar strip
---

# TabContainer

TabContainer arranges its children into a tabbed view, showing only the active tab's
child. The previewer draws the `panel` StyleBox behind the content band and positions the
current page below (or above) the strip. The strip is an internal TabBar (`tab_container.cpp:1280-1282`),
which the TabBar solver sizes and the TabBar painter draws. The container pushes its tab styles, scroll
icons, colours, font, font size and four constants onto the bar (`:314-344`).
The bar is always in front mode. The constructor adds it in front mode (`:1282`).
The setter re-adds it in front mode for `all_tabs_in_front = true` (`:876`).
It returns early for the default `false` (`:869-871`).
`self_modulate` tints the panel and the header band. The tab strip is a child TabBar and draws without it (`tab_container.cpp:247`, `tab_bar.cpp:1282`).

## Linting

<!-- lint:begin TabContainer -->
Strict parsing format-checks these `TabContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `all_tabs_in_front` | true or false |  |
| `clip_tabs` | true or false |  |
| `current_tab` | integer -1-4096 | error below, warning above |
| `deselect_enabled` | true or false |  |
| `drag_to_rearrange_enabled` | true or false |  |
| `switch_on_drag_hover` | true or false |  |
| `tab_#/*` | tab |  |
| `tab_alignment` | enum 0-2 (Left/Center/Right) | error |
| `tab_focus_mode` | enum 0-2 (None/Click/All) | warning |
| `tabs_position` | enum 0-1 (Top/Bottom) | error |
| `tabs_rearrange_group` | integer |  |
| `tabs_visible` | true or false |  |
| `use_hidden_tabs_for_min_size` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

The lenient parser reads the scalars above plus a sparse
`tab_<idx>/title,icon,disabled,hidden` override map, keyed by whatever index the file
names. TabContainer's own `array_length_getter` is its live child count, which is unknown
at parse time. So, unlike TabBar's `tab_count`-sized walk, this one builds no dense array
and applies no walk ceiling.
