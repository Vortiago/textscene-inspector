---
type: TabBar
category: 2D
status: unimplemented
fixture: unit-tab-bar.tscn
# image: unit-tab-bar
renders_as: invisible transform-only fallback
---

# TabBar

TabBar is the bare strip of tab headers, without the page switching a TabContainer adds.
The previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

## Linting

<!-- lint:begin TabBar -->
Strict parsing format-checks these `TabBar` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `clip_tabs` | true or false |  |
| `close_with_middle_mouse` | true or false |  |
| `current_tab` | integer -1-4096 | error below, warning above |
| `deselect_enabled` | true or false |  |
| `drag_to_rearrange_enabled` | true or false |  |
| `max_tab_width` | integer 0-99999 | error below, warning above |
| `scroll_to_selected` | true or false |  |
| `scrolling_enabled` | true or false |  |
| `select_with_rmb` | true or false |  |
| `switch_on_drag_hover` | true or false |  |
| `tab_#/*` | tab |  |
| `tab_alignment` | enum 0-2 (LEFT/CENTER/RIGHT) | error |
| `tab_close_display_policy` | enum 0-2 (SHOW_NEVER/SHOW_ACTIVE_ONLY/SHOW_ALWAYS) | error |
| `tab_count` | integer >= 0 | error below |
| `tabs_rearrange_group` | integer |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-tabbar-properties` | `tabbar-current-tab-out-of-range` | error |
|  | `tabbar-tab-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser reuses `parseControl` and reads only the Control layout keys, so
every TabBar key is absent from the lenient tree rather than substituted. The two
`linter.ts` advisories compare a `tab_<idx>/` index against `tab_count` and warn, since
the engine drops the write.

## Known limitations

- **Not drawn** Godot draws the row of tabs. The previewer draws nothing for this node.
