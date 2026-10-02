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
current page below (or above) the strip. It draws the strip through the same painter
TabBar uses.

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

## Known limitations

- **Approximated** The current tab draws in the unselected colour and StyleBox instead of
  `font_selected_color` and `tab_selected`, though its position, width and underline are
  exact.
- **Approximated** Under `layout_direction = 3`, a tab title in a right-to-left script
  keeps left-to-right glyph order, while the strip and its tabs still mirror.
- **Approximated** `tab_alignment = Right` never reclaims the strip's `side_margin`
  gutter when its own tabs overflow and scroll, a narrow case Godot's own
  `_update_margins` special-cases.
