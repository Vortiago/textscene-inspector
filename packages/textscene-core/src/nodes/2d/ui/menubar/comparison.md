---
type: MenuBar
category: 2D
status: unreviewed
fixture: unit-menu-bar.tscn
# image: unit-menu-bar
renders_as: one StyleBox + text run per PopupMenu-child title
---

# MenuBar

MenuBar is a horizontal strip of menu titles, one per PopupMenu child, that opens the
matching popup on click. The previewer draws each title's `normal` StyleBox (unless
`flat`) and its text, left to right with `h_separation` between them; the popups
themselves never open, since a PopupMenu is a Window and this previewer draws no Windows.

## Linting

<!-- lint:begin MenuBar -->
Strict parsing format-checks these `MenuBar` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `flat` | true or false |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `prefer_global_menu` | true or false |  |
| `start_index` | integer |  |
| `switch_on_hover` | true or false |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all six of MenuBar's own members. `parser.ts` reads
`flat`: a malformed value becomes `false`, with no warning. The other five
(`start_index`, `switch_on_hover`, `prefer_global_menu`, `text_direction`, `language`)
are behaviour, not pixels, and stay unread by the render parser. `text_direction` errors
outside `-1..3`, since the setter refuses anything else, while the inspector hint offers
only `0..3`.

Each title's text comes from its PopupMenu child's own `title` property when set, else
its node name — the same fallback `MenuBar::_refresh_menu_names` applies. A title is
always drawn in Godot's plain "normal" state: `disabled`/`hidden` per menu are runtime-only
APIs with no serialised property, so a `.tscn` can never author them.

## Known limitations

- **Approximated** A menu title's paragraph direction is not applied, so under
  `layout_direction = 3` a right-to-left script keeps left-to-right glyph order.
  Which end of the bar the titles start from does follow the layout direction.
- **Not drawn** Opening a menu, hovering a title and the `*_mirrored` hover and
  pressed StyleBoxes all need a pointer, so none of them appears.
