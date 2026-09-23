---
type: ColorPickerButton
category: 2D
status: unreviewed
fixture: unit-color-picker-button.tscn
# image: unit-color-picker-button
renders_as: a Button with a checkerboard + colour swatch over its face
---

# ColorPickerButton

ColorPickerButton is a Button that opens a ColorPicker popup and shows the chosen
`color` on its face. The previewer draws the button's chrome, then the
checkerboard and colour swatch on top, inset by the "normal" StyleBox's content
margins.

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

`index.ts` reads `color` (default: Godot's opaque black) with Button's properties. It
never reads `edit_alpha` or `edit_intensity`, so a malformed value for either loads and
renders the same as a well-formed one. A malformed `color = Color(1, 1)` fails `COLOR_RE`
and falls back to the white of `parseColor`.

## Known limitations

- **Not drawn** `edit_alpha`/`edit_intensity` only affect the internal `ColorPicker`
  popup, a `Window` this previewer never opens.
