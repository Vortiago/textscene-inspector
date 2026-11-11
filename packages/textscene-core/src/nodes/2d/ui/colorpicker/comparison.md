---
type: ColorPicker
category: 2D
status: unreviewed
fixture: unit-color-picker.tscn
# image: unit-color-picker
renders_as: the shape row, the sample row, the RGB/HSV/Linear mode row, the channel slider grid, the hex field and the swatches rows
---

# ColorPicker

ColorPicker is the widget for choosing a colour through sliders, a wheel, hex input and
presets. Its C++ constructor builds the whole widget as internal children, and a `.tscn`
never serialises them. So the previewer's painter draws the composite directly from
`color`, `picker_shape` and every row-visibility property, not from a subtree it could
walk. It draws these parts:

- The pick and shape buttons, with the `screen_picker` icon and the current shape's
  `shape_rect`, `shape_rect_wheel` or `shape_circle` icon, and the colour sample
  (checkerboard and swatch).
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
- The value `SpinBox` of each row, with the `up`/`down` stepper icons beside it. Its column is
  the `LineEdit` minimum plus the stepper block (`spin_box.cpp:82-86`). The "W" advance stays
  unrounded, and `GridContainer` truncates the sum (`grid_container.cpp:290`).
- The hex/expression field. For an HDR or negative `color`, `text_type` draws the disabled
  `script` icon where it shows "#" otherwise (`color_picker.cpp:1319-1325`).
- The swatches rows: a collapsed "Swatches" toggle with its `folded_arrow` and a menu
  button, and a "Recent Colors" toggle. Neither toggle changes state. This is all a
  `.tscn`-loaded picker holds: presets arrive only through `add_preset()` at runtime,
  never as a serialised property. Godot leaves the swatches grid collapsed until a viewer
  expands it, so there is no grid to draw.
- The shape row for every `picker_shape` but `SHAPE_NONE`: the HSV rectangle's SV square and
  hue slider, the HSV wheel, the VHS and OKHSL circles, and the OK HS and OK HL rectangles.
  Each wheel, circle and OK rectangle draws Godot's own `canvas_item` shader
  (`color_picker_shape.cpp:38-137`) with its cursors and its value slider. The row lays its
  controls out as the `shape_container` HBoxContainer does, so a circle keeps `sv_width` and a
  rectangle takes the width its slider leaves.

Every row-visibility flag also moves this node's minimum size, to match the combined
minimum of `real_vbox`. "Known limitations" lists everything else.

## Linting

<!-- lint:begin ColorPicker -->
Strict parsing format-checks these `ColorPicker` properties, plus 1 inherited from BoxContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `ColorPicker` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `can_add_swatches` | true or false |  |
| `color` | Color(r, g, b, a), or the colour string or int it converts |  |
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
visible, and signal timing. A `picker_shape` of `7` loads and draws the HSV rectangle, since
`set_picker_shape` refuses it (`color_picker.cpp:854`). A malformed `color` loads and renders
the same as a well-formed value. An absent `color` renders opaque white, not the
raw `Color()` member default, because `ColorPicker::ColorPicker()` calls
`set_pick_color(Color(1, 1, 1))` (`color_picker.cpp:2289`).

## Known limitations

- **Not matched** `self_modulate` tints every part of the picker. In Godot it tints only the
  picker's own drawing, and the shape row, the buttons, the sample and the sliders are internal
  child Controls that it does not reach.
- **Approximated** The minimum-size calculation floors the channel-label column at
  `label_width` (10px), not the widest label's width, which the shape row's 290px floor
  hides in every fixture.
- **Not drawn** Focus rings (`draw_focus_rect`/`draw_focus_circle`): a static previewer
  has no focus.
