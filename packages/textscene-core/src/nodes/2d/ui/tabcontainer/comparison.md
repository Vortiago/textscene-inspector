---
type: TabContainer
category: 2D
status: unimplemented
fixture: unit-tab-container.tscn
# image: unit-tab-container
renders_as: invisible transform-only fallback
---

# TabContainer

Arranges child Controls into a tabbed view, one tab per child, showing only the
active tab's control and hiding the rest. The previewer parses and validates
every member below but does not draw the tab bar yet: it renders as an invisible
transform-only fallback and its children still show, all at once rather than one
at a time.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `tab_alignment` | `1` (Center) | horizontal placement of the tab row |
| `current_tab` | `0` | which child's tab is active |
| `tabs_position` | `0` (Top) | tab bar above or below the panel |
| `clip_tabs` | `true` | overflowing tabs hide behind nav buttons rather than growing the min size |
| `tabs_visible` | `true` | tab bar drawn at all |
| `all_tabs_in_front` | `false` | inactive tabs drawn behind the panel |
| `switch_on_drag_hover` | `true` | dragging something over a tab switches to it |
| `drag_to_rearrange_enabled` | `true` | tabs can be reordered by mouse drag |
| `tabs_rearrange_group` | `0` | drag-rearrange group id shared with other TabContainers |
| `use_hidden_tabs_for_min_size` | `false` | hidden children excluded from the min-size total |
| `tab_focus_mode` | `2` (All) | focus access mode of the internal TabBar |
| `deselect_enabled` | `false` | clicking the active tab cannot deselect it |

## Divergences

Not captured yet: nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin TabContainer -->
Strict parsing format-checks these `TabContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `all_tabs_in_front` | true or false |  |
| `clip_tabs` | true or false |  |
| `current_tab` | integer >= -1 | error below |
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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl`, which only reads Control's own
properties (anchors, offsets, modulate, theme overrides). It never reads any of
the twelve properties above, so a bad `tab_alignment` or `current_tab` is not
substituted or clamped, it is simply never looked at: the node still falls back
to `GenericNodeFallback` and renders exactly as it would with valid values.
