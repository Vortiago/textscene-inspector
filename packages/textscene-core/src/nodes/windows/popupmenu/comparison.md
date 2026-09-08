---
type: PopupMenu
category: Other
status: unimplemented
fixture: unit-popup-menu.tscn
# image: unit-popup-menu
renders_as: invisible transform-only fallback
---

# PopupMenu

Godot's modal window for a list of options. The previewer parses and validates it, including the per-item `item_<index>/<leaf>` family, but does not draw it, so it mounts as an invisible transform-only group.

## Linting

<!-- lint:begin PopupMenu -->
Strict parsing format-checks these `PopupMenu` properties, plus 45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `allow_search` | true or false |  |
| `hide_on_checkable_item_selection` | true or false |  |
| `hide_on_item_selection` | true or false |  |
| `hide_on_state_item_selection` | true or false |  |
| `item_#/*` | item_<index>/<leaf> (see popup_menu.cpp, PropertyListHelper-backed) |  |
| `item_count` | integer >= 0 | error below |
| `prefer_native_menu` | true or false |  |
| `shrink_height` | true or false |  |
| `shrink_width` | true or false |  |
| `submenu_popup_delay` | float > 0 | error at or below 0 |
| `system_menu_id` | enum 0/2/3/4/5 (INVALID_MENU_ID/APPLICATION_MENU_ID/WINDOW_MENU_ID/HELP_MENU_ID/DOCK_MENU_ID) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
| `valid-popupmenu-properties` (type-family match) | `popupmenu-item-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser registers the generic `parseNode`, which never reads `item_0/text` or any other PopupMenu key. A bad value is carried in `rawProperties` and ignored by rendering, with no substitution or warning.

## Known limitations

- **Not drawn** Godot displays the menu once popped up. The previewer draws nothing for it.
