---
type: PopupMenu
category: Other
status: unimplemented
fixture: unit-popup-menu.tscn
# image: unit-popup-menu
renders_as: invisible transform-only fallback
---

# PopupMenu

PopupMenu is Godot's modal window for a list of options (toolbar/context menus). The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `title`, `size` | `"File"`, `Vector2i(200, 120)` | none: inherited from Window, format-checked only |
| `hide_on_item_selection`, `hide_on_checkable_item_selection`, `hide_on_state_item_selection` | `true`, `true`, `false` | none: format-checked only |
| `submenu_popup_delay` | `0.3` | none: format-checked only |
| `allow_search` | `true` | none: format-checked only |
| `system_menu_id` | `0` (INVALID_MENU_ID) | none: format-checked only |
| `prefer_native_menu`, `shrink_height`, `shrink_width` | `false`, `true`, `true` | none: format-checked only |
| `item_count` | `2` | none: declares 2 items; format-checked only |
| `item_0/text`, `item_0/id`, `item_1/text`, `item_1/checkable`, `item_1/checked`, `item_1/id` | `"Open"`, `0`, `"Autosave"`, `1`, `true`, `1` | none: real per-item state; format-checked only |

## Divergences

Not captured yet.

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

`linterParser.ts` format-checks every declared own member of `PopupMenu` (the ten
properties above minus `title`/`size`, which are Window's) plus the seven
`item_<idx>/<leaf>` leaves Godot serialises through `PropertyListHelper`
(`_get_property_list`/`_set`/`_get`, never `ADD_PROPERTY`). Godot glues the item
index straight onto `item_` with no separating slash, so the family registers
under the `item_#/*` pattern rather than `item_/*`.

`linter.ts` holds the one bound a per-property validator cannot see: an index at
or past `item_count`. `PropertyListHelper::_get_property`
(property_list_helper.cpp:58) returns null for it and `PopupMenu::_set`
(popup_menu.cpp:3092) passes that refusal straight out, so the leaf setter is
never called and the value is dropped on load.

The lenient parser reads none of this: `parser.ts` reuses the generic `parseNode`,
which never reads `item_0/text` (or any other PopupMenu key), so a bad value there
is neither substituted nor warned on. It is carried in the node's `rawProperties`
and ignored by rendering, exactly like every other unread key on an invisible
fallback node.
