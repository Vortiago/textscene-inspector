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
it could walk. It draws the pick/shape buttons (with their own `screen_picker`/`shape_rect`
icons) and colour sample (checkerboard + swatch), the RGB/HSV/Linear mode row (OKHSL has
no button of its own — only the dropdown reaches it; the CURRENT mode's button draws
`TabContainer`'s own `tab_selected` box and white `font_pressed_color` text,
`BIND_THEME_ITEM_EXT`'d in from `color_picker.cpp:2060-2062`, every other mode button
`tab_unselected`, plus `btn_mode`'s own `menu_option` icon), the channel slider grid for
the current `color_mode` (with the
alpha/intensity rows `edit_alpha`/`edit_intensity` add) — every channel/alpha row draws
the stock `HSlider` chrome underneath its gradient band and the `bar_arrow` grabber
`_reset_sliders_theme` overrides it to (`color_picker.cpp:628-651`); intensity alone
keeps the default circle grabber, since that override skips it. Each row's own value
`SpinBox` draws only its `LineEdit` field's real width (`spin_box.cpp:82-86`), with the
`up`/`down` stepper icons in the buttons block beside it — the hex/expression
field, and
the swatches rows — a collapsed "Swatches" toggle (with its own `folded_arrow`, always
the state since neither ever toggles) + menu button and a "Recent Colors" toggle, which
is the true content of a `.tscn`-loaded picker: presets only ever arrive
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
- **Not drawn** `text_type`'s own `script` icon (`theme_cache.color_script`,
  `color_picker.cpp:1324`) — only reachable once `text_is_constructor` flips true (an HDR
  or negative `color`, `hexFieldText`'s own doc), which no shipped fixture exercises; its
  box (`StyleBoxEmpty`, drawn but invisible) and its `""` text still render correctly
  either way.
- **Approximated** The HSV hue channel row (`color_mode = MODE_HSV`, slider index 0)
  draws a flat grey base at full opacity instead of `ColorModeHSV::slider_draw`'s own
  rainbow-texture overlay blended in at `alpha = saturation` (`color_mode.cpp:218-221`);
  no shipped fixture selects `MODE_HSV`.
- **Approximated** `colorPickerMinimumSize`'s own slider-row width term still floors the
  channel-label column to `label_width` (10px) rather than the widest label's own shaped
  text (`colorPickerLabelColumnWidth`'s own doc) — deriving the right label SET there
  needs `colorPickerSliderLabels` (`colorModes.ts`), which already imports THIS module,
  so pulling it in would cycle. The RENDERED slider grid (`Component.tsx`, which already
  knows the current row set) uses the real widened column; only the minimum-size
  calculation keeps the floor, and the shape row's own 290px floor still dominates this
  node's real minimum width in every case any shipped fixture exercises.
- **Not drawn** Focus rings (`draw_focus_rect`/`draw_focus_circle`) — a static previewer
  has no focus.
