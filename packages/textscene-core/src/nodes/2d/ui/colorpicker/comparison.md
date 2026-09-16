---
type: ColorPicker
category: 2D
status: unreviewed
fixture: unit-color-picker.tscn
# image: unit-color-picker
renders_as: the sample row, the RGB/HSV/Linear mode row, the channel slider grid, the hex field, the swatches rows and, at the default picker_shape, an SV square + hue slider
---

# ColorPicker

ColorPicker is the widget for choosing a colour through sliders, a wheel, hex input and
presets. It builds its whole widget as internal children in its C++ constructor, none of
which a `.tscn` ever serialises, so this previewer's painter draws the composite
directly from `color`/`picker_shape`/every row-visibility property rather than a subtree
it could walk. It draws the pick/shape buttons and colour sample (checkerboard +
swatch), the RGB/HSV/Linear mode row (OKHSL has no button of its own — only the
dropdown reaches it, and no button visibly differs by which mode is current either, see
"Known limitations"), the channel slider grid for the current `color_mode` (with the
alpha/intensity rows `edit_alpha`/`edit_intensity` add), the hex/expression field, and
the swatches rows — an empty "Swatches" toggle + menu button and a "Recent Colors"
toggle, which is the true content of a `.tscn`-loaded picker: presets only ever arrive
through `add_preset()` at runtime, never a serialised property, and Godot itself leaves
the swatches grid collapsed until a viewer expands it, so there is no grid to draw.
Every row-visibility flag also moves this node's minimum size, matching
`real_vbox`'s own combined minimum. At the default `picker_shape` (the HSV rectangle) it
also draws the SV square and hue slider with their cursor/indicator. Everything else is
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

`index.ts` reads `color`, `picker_shape`, `color_mode`, `color_modes_visible`,
`sliders_visible`, `hex_visible`, `presets_visible`, `sampler_visible`, `edit_alpha` and
`edit_intensity` alongside VBoxContainer's own properties. `can_add_swatches` and
`deferred_mode` stay unread — see the allowlist's own citation for why (a
never-visible button, and signal timing). A `picker_shape` of `7` or a malformed
`color` loads and renders the same as a well-formed value; an absent `color` renders
opaque WHITE (`ColorPicker::ColorPicker()` calls `set_pick_color(Color(1, 1, 1))`,
`color_picker.cpp:2289`), not the raw `Color()` member default.

## Known limitations

- **Shader missing** `picker_shape` values other than `0` (HSV Rectangle) select a
  shader-backed shape (wheel, VHS/OKHSL circle, either OK rectangle) this previewer does
  not reproduce; only the sample row and the shape row's own (zero-height) stacking slot
  draw. `SHAPE_NONE` (4) draws nothing in Godot too, so it is not a gap.
- **Not drawn** `btn_pick`/`btn_shape`/`btn_mode`/`menu_btn`/`text_type`'s own icons —
  `themeIcons.ts` vendors none of them (out of this slice's files). Their box (where they
  have a real one — only `btn_pick`) and their text still draw.
- **Not drawn** The stock `HSlider` chrome (background/grabber-area/grabber icon,
  `shared/sliderSolver.ts`'s own recipe) behind each channel slider — only the 16px
  gradient band every `slider_draw` override paints on top is drawn.
- **Approximated** `color_mode`'s Linear channel sliders interpolate their gradient band
  in sRGB space, like the RGB mode's own; Godot's `GRADIENT_COLOR_SPACE_LINEAR_SRGB`
  interpolates the same two endpoints in linear space instead, a difference only in the
  gradient's interior.
- **Approximated** Every column width in the slider grid, the hex field's own `LineEdit`,
  and the swatches row's `menu_btn` floor to literal constants rather than Godot's real
  `SpinBox`/`LineEdit` natural-width algorithm (`spin_box.cpp:82-86`) — row HEIGHT is
  exact (from the same shaped text this previewer paints), only width is approximated,
  and the shape row's own 290px floor dominates the node's real minimum width in every
  case this fixture exercises.
- **Not drawn** Focus rings (`draw_focus_rect`/`draw_focus_circle`) — a static previewer
  has no focus.
