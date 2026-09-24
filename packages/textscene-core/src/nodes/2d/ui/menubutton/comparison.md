---
type: MenuButton
category: 2D
status: unreviewed
fixture: unit-menu-button.tscn
# image: unit-menu-button
renders_as: a StyleBox quad with a centred text run and optional icon
---

# MenuButton

MenuButton is a Button that opens an internal PopupMenu when pressed. `menu_button.cpp`
draws no chrome of its own, so the previewer paints what its `Button` base does. The
internal PopupMenu never opens, since it is a Window and this previewer draws no
Windows.

## Linting

<!-- lint:begin MenuButton -->
Strict parsing format-checks these `MenuButton` properties, plus 13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `item_count` | integer >= 0 | error below |
| `popup/item_#/*` | item |  |
| `switch_on_hover` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
| `valid-menubutton-properties` (type-family match) | `menubutton-item-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser reuses `parseButton`, plus one default that MenuButton's constructor
overrides: `flat` defaults to `true` here (`MenuButton::MenuButton()` calls
`set_flat(true)`), not Button's `false`. A `.tscn` writes `flat` only when it differs
from that default. `switch_on_hover`, `item_count` and every `popup/item_<idx>/<leaf>`
key are never read, since none of them affects MenuButton's drawing. They govern only
the contents and behaviour of the internal PopupMenu.

MenuButton's default theme registers `font_disabled_color` as `Color(1, 1, 1, 0.3)`, not
Button's `control_font_disabled_color` (`Color(0.875, 0.875, 0.875, 0.5)`). It is the one
default this slice does not inherit from Button.

## Known limitations

- **Approximated** The label's paragraph direction is not applied, so under
  `layout_direction = 3` or `text_direction = 2` a right-to-left script, or a label
  ending in punctuation, keeps left-to-right glyph order. Which side the label, the
  icon and the chrome sit on does follow the layout direction.
