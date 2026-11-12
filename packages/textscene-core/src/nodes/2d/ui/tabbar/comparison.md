---
type: TabBar
category: 2D
status: unreviewed
fixture: unit-tab-bar.tscn
# image: unit-tab-bar
renders_as: a row of per-tab StyleBox quads with icon/title/close-icon content
---

# TabBar

TabBar is the bare strip of tab headers, without the page switching a TabContainer adds.
The previewer draws each tab's own `tab_selected`/`tab_unselected`/`tab_disabled` StyleBox,
its icon and its title. It adds the close icon where `tab_close_display_policy` calls for it.
It adds the scroll arrows once the tabs overflow a clipped bar. A clipped strip starts at the
tab that brings the current tab into view, as `ensure_tab_visible` does. TabContainer's strip
does the same, after its hidden pages and its `side_margin` reclaim. A tab that `max_tab_width`
caps trims its title as `TextLine` does.
The default-theme icons are Godot's own ThorVG rasters at theme scale 1, so their anti-aliased edges match. At another `gui/theme/default_theme_scale` the icons and the minimum size scale together, and the browser rasters the scaled SVG, so the edge pixels differ by a rim.

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

The lenient parser reads `current_tab`, `tab_alignment`, `tab_close_display_policy`,
`max_tab_width`, `clip_tabs` and the rest of the scalars. It walks a dense `tab_<idx>/*`
family (`title`/`tooltip`/`icon`/`disabled`), aligned to `tab_count` like OptionButton's
`item_<idx>/*` walk. The two `linter.ts` advisories compare a
`tab_<idx>/` index against `tab_count` and warn, since the engine drops the write.

## Known limitations

- **Not drawn** The drag drop-mark, and the hover and pressed chrome of a tab, its close
  button and the scroll arrows, since each needs a pointer.
