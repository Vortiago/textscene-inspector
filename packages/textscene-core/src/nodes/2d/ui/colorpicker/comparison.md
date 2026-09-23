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
presets. Its C++ constructor builds the whole widget as internal children, and a `.tscn`
never serialises them. So the previewer's painter draws the composite directly from
`color`, `picker_shape` and every row-visibility property, not from a subtree it could
walk. It draws these parts:

- The pick and shape buttons, with their `screen_picker` and `shape_rect` icons, and the
  colour sample (checkerboard and swatch).
- The RGB/HSV/Linear mode row. OKHSL has no button, and only the dropdown reaches it.
  The current mode's button draws `TabContainer`'s `tab_selected` box and white
  `font_pressed_color` text, which `BIND_THEME_ITEM_EXT` brings in from
  `color_picker.cpp:2060-2062`. Every other mode button draws `tab_unselected`, and
  `btn_mode` adds its `menu_option` icon.
- The channel slider grid for the current `color_mode`, with the alpha and intensity rows
  that `edit_alpha` and `edit_intensity` add. Every channel and alpha row draws the stock
  `HSlider` chrome under its gradient band, with the `bar_arrow` grabber that
  `_reset_sliders_theme` sets (`color_picker.cpp:628-651`). Intensity keeps the default
  circle grabber, since that override skips it.
- The value `SpinBox` of each row, drawn at the real width of its `LineEdit` field
  (`spin_box.cpp:82-86`), with the `up`/`down` stepper icons in the buttons block beside
  it.
- The hex/expression field.
- The swatches rows: a collapsed "Swatches" toggle with its `folded_arrow` and a menu
  button, and a "Recent Colors" toggle. Neither toggle changes state. This is all a
  `.tscn`-loaded picker holds: presets arrive only through `add_preset()` at runtime,
  never as a serialised property. Godot leaves the swatches grid collapsed until a viewer
  expands it, so there is no grid to draw.
- At the default `picker_shape` (the HSV rectangle), the SV square and the hue slider
  with their cursor and indicator.

Every row-visibility flag also moves this node's minimum size, to match the combined
minimum of `real_vbox`. "Known limitations" lists everything else.

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
`edit_intensity` with VBoxContainer's properties. `can_add_swatches` and `deferred_mode`
stay unread, and the allowlist's citation gives the reason: a button that is never
visible, and signal timing. A `picker_shape` of `7` or a malformed `color` loads and
renders the same as a well-formed value. An absent `color` renders opaque white, not the
raw `Color()` member default, because `ColorPicker::ColorPicker()` calls
`set_pick_color(Color(1, 1, 1))` (`color_picker.cpp:2289`).

## Known limitations

- **Shader missing** A `picker_shape` other than `0` (HSV Rectangle) selects a
  shader-backed shape (wheel, VHS/OKHSL circle, either OK rectangle) that this previewer
  does not reproduce. Only the sample row and the zero-height stacking slot of the shape
  row draw. `SHAPE_NONE` (4) draws nothing in Godot too, so it is not a gap.
- **Not drawn** The `script` icon of `text_type` (`theme_cache.color_script`,
  `color_picker.cpp:1324`). It is reachable only once `text_is_constructor` turns true,
  for an HDR or negative `color` (see the doc of `hexFieldText`). Its box (`StyleBoxEmpty`, drawn but invisible) and its `""` text still
  render correctly.
- **Approximated** The HSV hue channel row (`color_mode = MODE_HSV`, slider index 0)
  draws a flat grey base at full opacity. `ColorModeHSV::slider_draw` blends a
  rainbow-texture overlay in at `alpha = saturation` (`color_mode.cpp:218-221`).
- **Approximated** The slider-row width term of `colorPickerMinimumSize` floors the
  channel-label column to `label_width` (10px), not to the shaped width of the widest
  label (see the doc of `colorPickerLabelColumnWidth`). The right label set comes from
  `colorPickerSliderLabels` (`colorModes.ts`), which imports this module, so using it
  there makes an import cycle. The rendered slider grid (`Component.tsx`) uses the real
  widened column. Only the minimum-size calculation keeps the floor, and the 290px floor
  of the shape row sets this node's minimum width in every shipped fixture.
- **Not drawn** Focus rings (`draw_focus_rect`/`draw_focus_circle`): a static previewer
  has no focus.
