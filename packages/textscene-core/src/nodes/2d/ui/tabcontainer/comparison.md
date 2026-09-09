---
type: TabContainer
category: 2D
status: unimplemented
fixture: unit-tab-container.tscn
# image: unit-tab-container
renders_as: invisible transform-only fallback
---

# TabContainer

TabContainer arranges its children into a tabbed view, showing only the active tab's
child. The previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

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

The lenient parser reuses `parseControl`, which reads only Control's own properties.
None of the twelve TabContainer keys is read, so a bad `tab_alignment` or `current_tab`
is never looked at.

## Known limitations

- **Not drawn** Godot draws the tab bar and shows one child at a time. The previewer
  draws no tab bar, and every child shows at once.
