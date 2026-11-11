---
type: PopupMenu
category: 2D
fixture: unit-popup-menu-embedded.tscn
renders_as: its items in a bordered panel, drawn by its embedder with no frame
---

# PopupMenu

Godot's menu of items. The previewer draws a visible one as an embedded, borderless, transparent
window. It draws the panel and each item row. A scroll bar shows where the items do not fit. The menu
embeds in the nearest viewport above it that embeds subwindows, which is never a Window under an
embedding root.

## Items

<!-- compare: image=unit-popup-menu-embedded status=done fixture=unit-popup-menu-embedded.tscn -->

The window takes the size of its items. A check or radio item shows its mark in a gutter that every row
keeps. A separator is a line between the rows. A disabled item takes the disabled font colour.

## Right to left

<!-- compare: image=unit-popup-menu-rtl status=done fixture=unit-popup-menu-rtl.tscn -->

Under a right-to-left parent, the marks and icons sit at the right edge and the text runs from it. A
labelled separator keeps its text where it is centred, and its icon moves to the right of the text.

## Scroll

<!-- compare: image=unit-popup-menu-scroll status=done fixture=unit-popup-menu-scroll.tscn -->

The menu height is limited to the embedder's. Items taller than that scroll, and the vertical bar
takes 8 px from the width of the item column.

## Outline

<!-- compare: image=unit-popup-menu-outline status=done fixture=unit-popup-menu-outline.tscn -->

The `outline_size` and `font_outline_color` theme items stroke a ring under each item label. A separator
label takes `separator_outline_size` and `font_separator_outline_color`. A size of 0, or a colour with no
alpha, draws no ring.

## Size line below the items

<!-- compare: image=unit-popup-menu-size-after-items status=done fixture=unit-popup-menu-size-after-items.tscn -->

Godot applies the properties in file order. A `size` line below the items is clamped to the minimum of
those items while the menu is outside the tree. The window keeps the full item height and does not
take the height limit. Godot saves `size` above the items, which gives the limited height.

## Under a Window

<!-- compare: image=unit-popup-menu-in-window status=done fixture=unit-popup-menu-in-window.tscn -->

A Window that enters the tree under an embedding root resets its own `gui_embed_subwindows` to
`force_native`. A menu below it therefore embeds in the root viewport and draws over the frame, not
inside the Window. A SubViewport with `gui_embed_subwindows` keeps its menus inside it, and limits their
height to its own.

## Project that embeds no windows

<!-- compare: image=unit-popup-menu-embed-off status=done fixture=window-embed-off/unit-popup-menu-embed-off.tscn -->

When `display/window/subwindows/embed_subwindows` is off, the root resets no Window. A Window that
authors `gui_embed_subwindows` keeps it, so the menu below it draws inside the Window.

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
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
|  | `window-force-native-refused-while-visible` | error |
| `valid-popupmenu-properties` (type-family match) | `popupmenu-item-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser reads the Window keys with the PopupMenu class defaults: hidden, borderless,
transparent and `wrap_controls` on. It also reads the `item_<index>/<leaf>` family: text, icon,
checkable, checked, disabled and separator, which are the only item keys a scene file sets. An item past
`item_count` is dropped. A `checkable` outside 0 to 2 reads as not checkable.
