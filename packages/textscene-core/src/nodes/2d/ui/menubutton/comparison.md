---
type: MenuButton
category: 2D
status: unimplemented
fixture: unit-menu-button.tscn
# image: unit-menu-button
renders_as: invisible transform-only fallback
---

# MenuButton

MenuButton is a Button that opens an internal PopupMenu when pressed. The previewer
parses and validates it but does not draw it, so it renders as a transform-only fallback
and its children still show.

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

The lenient parser reuses `parseButton` unchanged, which reads Button's and Control's
keys and nothing else. `switch_on_hover`, `item_count` and every
`popup/item_<idx>/<leaf>` key are never read, so a bad value there is neither
substituted nor warned on.

## Known limitations

- **Not drawn** Godot draws the button and its label. The previewer draws nothing for
  this node.
