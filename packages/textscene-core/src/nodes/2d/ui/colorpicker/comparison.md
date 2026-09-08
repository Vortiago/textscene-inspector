---
type: ColorPicker
category: 2D
status: unimplemented
fixture: unit-color-picker.tscn
# image: unit-color-picker
renders_as: invisible transform-only fallback, not drawn yet
---

# ColorPicker

A widget for selecting a colour through sliders, a wheel/rectangle, hex input and
presets. It is a Control (ADR-0003 routes Controls through the 2D DOM
overlay), so the previewer parses and validates every member below but does
not draw it yet: it renders as an invisible transform-only fallback and its
children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `color` | `Color(0.2, 0.4, 0.6, 0.8)` | the initially selected, partially transparent colour |
| `edit_alpha` | `false` | hides the alpha channel slider |
| `edit_intensity` | `false` | hides the intensity slider |
| `color_mode` | `1` | starts in HSV mode instead of RGB |
| `deferred_mode` | `true` | applies the picked colour only once the mouse button is released |
| `picker_shape` | `1` | shows the HSV wheel shape instead of the rectangle |
| `can_add_swatches` | `false` | disables the add-preset button under Swatches |
| `sampler_visible` | `false` | hides the eyedropper and the colour preview swatch |
| `color_modes_visible` | `false` | hides the RGB/HSV/OKHSL mode buttons |
| `sliders_visible` | `false` | hides the channel sliders |
| `hex_visible` | `false` | hides the hex colour code input field |
| `presets_visible` | `false` | hides the Swatches and Recent Colors sections |

## Divergences

Not captured yet: nothing renders, so there is nothing to compare pixels against.

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

None of ColorPicker's own properties are read by `index.ts` today: it reuses
`parseVBoxContainer` unchanged (ADR-0003: the node draws nothing), so a
malformed `color_mode`, `picker_shape` or `color` value parses without
incident under the lenient parser and never reaches any consumer. The strict
parser is the only one that inspects these keys at all; a bad `picker_shape`
such as `7` loads and renders identically to a well-formed scene, silently.
