---
type: ColorPicker
category: 2D
status: unreviewed
fixture: unit-color-picker.tscn
# image: unit-color-picker
renders_as: a colour sample and, at the default picker_shape, an SV square + hue slider
---

# ColorPicker

ColorPicker is the widget for choosing a colour through sliders, a wheel, hex input and
presets. It builds its whole widget as internal children in its C++ constructor, none of
which a `.tscn` ever serialises, so this previewer's painter draws the composite
directly from `color`/`picker_shape` rather than a subtree it could walk. It draws the
colour sample (checkerboard + swatch) and, at the default `picker_shape` (the HSV
rectangle), the SV square and hue slider with their cursor/indicator. Everything else is
a documented gap — see "Known limitations".

## Linting

<!-- lint:begin ColorPicker -->
Strict parsing format-checks these `ColorPicker` properties, plus 1 inherited from BoxContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `ColorPicker` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `can_add_swatches` | true or false |  |
| `color` | Color(r, g, b, a) |  |
| `color_mode` | enum 0-3 (MODE_RGB/MODE_HSV/MODE_LINEAR/MODE_OKHSL) | error |
| `color_modes_visible` | true or false |  |
| `deferred_mode` | true or false |  |
| `edit_alpha` | true or false |  |
| `edit_intensity` | true or false |  |
| `hex_visible` | true or false |  |
| `picker_shape` | enum 0-6 (SHAPE_HSV_RECTANGLE/SHAPE_HSV_WHEEL/SHAPE_VHS_CIRCLE/SHAPE_OKHSL_CIRCLE/SHAPE_NONE/SHAPE_OK_HS_RECTANGLE/SHAPE_OK_HL_RECTANGLE) | error |
| `presets_visible` | true or false |  |
| `sampler_visible` | true or false |  |
| `sliders_visible` | true or false |  |
| `vertical` | **not available on this type** |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`index.ts` reads `color` and `picker_shape` alongside VBoxContainer's own properties;
`color_mode`, `can_add_swatches`, `sampler_visible`, `color_modes_visible`,
`sliders_visible`, `hex_visible`, `presets_visible`, `deferred_mode`, `edit_alpha` and
`edit_intensity` all stay unread — each toggles a row this previewer does not draw
(below). A `picker_shape` of `7` or a malformed `color` loads and renders the same as a
well-formed value.

## Known limitations

- **Shader missing** `picker_shape` values other than `0` (HSV Rectangle) select a
  shader-backed shape (wheel, VHS/OKHSL circle, either OK rectangle) this previewer does
  not reproduce; only the sample row draws. `SHAPE_NONE` (4) draws nothing in Godot too,
  so it is not a gap.
- **Not drawn** The pick/shape buttons beside the sample, the RGB/HSV/Raw/OKHSL mode
  row, the channel slider grid, the hex field and the swatches row are not drawn, and
  none of their height is counted toward this node's minimum size — a real child placed
  after them in the scene (a rare pattern for this type) is positioned higher than
  Godot's own layout.
- **Approximated** The sample row's height stands in for the (undrawn) pick/shape
  buttons' own natural height, from their 16x16 icons plus the button content margin,
  not their real minimum size.
- **Not drawn** Focus rings (`draw_focus_rect`/`draw_focus_circle`) — a static previewer
  has no focus.
