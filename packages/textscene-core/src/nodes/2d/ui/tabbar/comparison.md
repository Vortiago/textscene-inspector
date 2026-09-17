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
its icon and title, the close icon where `tab_close_display_policy` calls for it, and the
scroll arrows once the tabs overflow a clipped bar.

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
`max_tab_width`, `clip_tabs` and the rest of the scalars alongside a dense `tab_<idx>/*`
walk (`title`/`tooltip`/`icon`/`disabled`), aligned to `tab_count` the same way
OptionButton's `item_<idx>/*` walk is. The two `linter.ts` advisories compare a
`tab_<idx>/` index against `tab_count` and warn, since the engine drops the write.

## Known limitations

- **Approximated** The selected tab's `font_selected_color` and its `tab_selected`
  StyleBox are not distinguished from the unselected ones, so the current tab
  reads as the same colour and box as its neighbours. Its position, width and
  the underline above it are exact; this is the whole of the residual any tab
  fixture still measures against Godot.
- **Approximated** A tab title's paragraph direction is not applied, so under
  `layout_direction = 3` a right-to-left script, or a title ending in punctuation,
  keeps left-to-right glyph order. Where each tab sits in the strip, and where its
  icon, title and close icon sit inside it, do follow the layout direction.
- **Not drawn** The drag drop-mark and the hover and pressed chrome on a tab, its
  close button and the scroll arrows all need a pointer, so none of them appears.
- **Approximated** `max_tab_width` correctly caps a tab's on-screen width and
  reserves the same pixel budget Godot does, but the glyphs inside that budget draw
  unclipped rather than as Godot's own `OVERRUN_TRIM_ELLIPSIS` truncation with a
  trailing "…".
