---
type: TabBar
category: 2D
status: unimplemented
fixture: unit-tab-bar.tscn
# image: unit-tab-bar
renders_as: invisible transform-only fallback
---

# TabBar

TabBar is the bare strip of tab headers, without the page-switching a
TabContainer adds: Godot draws one themed `StyleBox` per tab along a single
horizontal row, each with its title text, an optional icon, an optional close
button, and left/right scroll arrows once the row overflows. The previewer
parses and validates every member below but does not draw it yet, so it renders
as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layout_mode` | `1` | anchored layout mode, inherited from Control |
| `offset_left` | `8.0` | left edge of the anchored rect, inherited from Control |
| `offset_top` | `8.0` | top edge of the anchored rect, inherited from Control |
| `offset_right` | `308.0` | right edge of the anchored rect, inherited from Control |
| `offset_bottom` | `40.0` | bottom edge of the anchored rect, inherited from Control |
| `current_tab` | `1` | selects the second tab, drawn with the `tab_selected` StyleBox |
| `tab_alignment` | `1` | ALIGNMENT_CENTER: the row of tabs is centred in the bar |
| `clip_tabs` | `false` | the bar's minimum width grows to fit every tab instead of clipping and scrolling |
| `close_with_middle_mouse` | `false` | a middle click no longer emits `tab_close_pressed` |
| `tab_close_display_policy` | `2` | CLOSE_BUTTON_SHOW_ALWAYS: every tab draws a close button |
| `max_tab_width` | `120` | caps each tab's width at 120px, truncating longer titles |
| `scrolling_enabled` | `false` | the mouse wheel no longer scrolls the tab row |
| `drag_to_rearrange_enabled` | `true` | tabs can be dragged into a new order |
| `switch_on_drag_hover` | `false` | hovering a tab mid-drag no longer selects it |
| `tabs_rearrange_group` | `0` | tabs may be dragged to any other TabBar sharing group 0 |
| `scroll_to_selected` | `false` | the bar does not scroll to keep `current_tab` visible |
| `select_with_rmb` | `true` | a right click selects a tab as well as emitting `tab_rmb_clicked` |
| `deselect_enabled` | `true` | clicking the selected tab may deselect it, leaving `current_tab` at -1 |
| `tab_count` | `3` | sizes the tab array; every `tab_<idx>/…` key below indexes into it |
| `tab_0/title` | `"Inventory"` | first tab's label text |
| `tab_0/tooltip` | `"Everything you carry"` | first tab's hover tooltip, not drawn in a static frame |
| `tab_0/icon` | `SubResource(…)` | 16x16 PlaceholderTexture2D drawn left of the first tab's title |
| `tab_1/title` | `"Map"` | second tab's label text |
| `tab_2/title` | `"Journal"` | third tab's label text |
| `tab_2/disabled` | `true` | third tab is drawn with the `tab_disabled` StyleBox and cannot be selected |

## Divergences

Not captured yet: the previewer draws no TabBar, so there is no rendered output
to compare against Godot's.

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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-tabbar-properties` | `tabbar-current-tab-out-of-range` | error |
|  | `tabbar-tab-index-out-of-range` | error |
<!-- lint:end -->

Nothing on TabBar diverges between the two parsers. The lenient parser reuses
`parseControl` and reads only the Control layout members, so every TabBar-specific
key above is simply absent from the lenient tree rather than substituted with a
fallback value; the strict parser is the only one that looks at them. The two
cross-field advisories both compare an index against `tab_count`, which is a
sibling property no per-key validator can see, so they live in `linter.ts` and
report as warnings: the engine drops the offending write rather than refusing
the file.
