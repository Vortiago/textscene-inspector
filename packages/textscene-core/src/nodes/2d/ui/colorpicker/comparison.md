---
type: ColorPicker
category: 2D
status: unimplemented
fixture: unit-color-picker.tscn
# image: unit-color-picker
renders_as: invisible transform-only fallback, not drawn yet
---

# ColorPicker

ColorPicker is the widget for choosing a colour through sliders, a wheel, hex input and
presets. The previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`index.ts` reuses `parseVBoxContainer` unchanged, which reads none of ColorPicker's own
keys. A `picker_shape` of `7` or a malformed `color` loads and renders the same as a
well-formed value.

## Known limitations

- **Not drawn** Godot draws the whole picker. The previewer draws nothing for this node.
