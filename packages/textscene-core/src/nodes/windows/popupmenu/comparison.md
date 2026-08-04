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
| `system_menu_id` | `0` (None) | none: format-checked only |
| `prefer_native_menu`, `shrink_height`, `shrink_width` | `false`, `true`, `true` | none: format-checked only |
| `item_count` | `2` | none: declares 2 items; format-checked only |
| `item_0/text`, `item_0/id`, `item_1/text`, `item_1/checkable`, `item_1/checked`, `item_1/id` | `"Open"`, `0`, `"Autosave"`, `1`, `true`, `1` | none: real per-item state; not yet reachable by the validator registry (see Linting) |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin PopupMenu -->
Strict parsing format-checks these `PopupMenu` properties, plus 45 inherited from Window, 9 inherited from Viewport, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `allow_search` | true or false |
| `hide_on_checkable_item_selection` | true or false |
| `hide_on_item_selection` | true or false |
| `hide_on_state_item_selection` | true or false |
| `item_#/*` | item_<index>/<leaf> (see popup_menu.cpp, PropertyListHelper-backed) |
| `item_count` | integer >= 0 |
| `prefer_native_menu` | true or false |
| `shrink_height` | true or false |
| `shrink_width` | true or false |
| `submenu_popup_delay` | float >= 5e-324 |
| `system_menu_id` | enum 0-5 (NONE/APPLICATION_MENU/WINDOW_MENU/HELP_MENU/DOCK) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks every declared own member of `PopupMenu` (the ten
properties above minus `title`/`size`, which are Window's) plus the seven
`item_<idx>/<leaf>` leaves Godot serialises through `PropertyListHelper`
(`_get_property_list`/`_set`/`_get`, never `ADD_PROPERTY`). That family cannot be
reached through the strict linter's registry today: the registry's wildcard match
needs a literal `/` right after a fixed prefix, and Godot glues the item index
straight onto `item_` with no separating slash, so a real `item_0/text` key never
routes to a validator. The lenient parser has the same blind spot from the other
side: `parser.ts` reuses the generic `parseNode`, which never reads `item_0/text`
(or any other PopupMenu key) at all, so a bad value there, say `item_0/checkable
= "yes"`, is neither substituted nor warned on. It is simply carried in the node's
`rawProperties` and ignored by rendering, exactly like every other unread key on
an invisible fallback node.
