---
type: ColorPickerButton
category: 2D
status: unimplemented
fixture: unit-color-picker-button.tscn
# image: unit-color-picker-button
renders_as: invisible transform-only fallback, not drawn yet
---

# ColorPickerButton

ColorPickerButton is a Button that opens a ColorPicker popup and shows the chosen
`color` on its face. The previewer parses and validates it but does not draw it, so it
renders as a transform-only fallback and its children still show.

## Linting

<!-- lint:begin ColorPickerButton -->
Strict parsing format-checks these `ColorPickerButton` properties, plus 13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `color` | Color(r, g, b, a) |  |
| `edit_alpha` | true or false |  |
| `edit_intensity` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`index.ts` reuses `parseButton` unchanged, which never reads `color`, `edit_alpha` or
`edit_intensity`. A malformed `color = Color(1, 1)` loads and renders the same as a
well-formed one, since nothing consumes it.

## Known limitations

- **Not drawn** Godot draws the button with its colour swatch. The previewer draws
  nothing for this node.
