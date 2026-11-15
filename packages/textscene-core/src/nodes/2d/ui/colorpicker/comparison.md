---
type: ColorPicker
category: 2D
status: unreviewed
fixture: unit-color-picker.tscn
# image: unit-color-picker
renders_as: the shape row, the sample row, the RGB/HSV/Linear mode row, the channel slider grid, the hex field and the swatches rows
---

# ColorPicker

ColorPicker is the widget for choosing a colour through sliders, a shape, hex input and
presets. Its constructor builds the whole widget as internal Controls, which a `.tscn` never
serialises. `internalControls.ts` builds the same Control tree from `color`, `picker_shape`,
`color_mode` and every row-visibility property, with what `NOTIFICATION_THEME_CHANGED`,
`_update_controls`, `_update_color` and `_update_text_value` set on each Control. The one solve
lays the tree out and the walker draws each Control with its own painter, as it draws a scene's
Controls. The tree holds these rows:

- `shape_container`, an HBoxContainer with the Controls of the current `picker_shape`. The
  shapes are the HSV rectangle, the HSV wheel, the VHS and OKHSL circles, and the OK HS and OK HL
  rectangles.
  Each Control draws what its `draw` callback draws, with Godot's own `canvas_item` shader for a
  wheel, circle or OK rectangle (`color_picker_shape.cpp:38-137`). At `SHAPE_NONE` the row holds
  nothing but keeps its slot.
- `sample_hbc`: `btn_pick` with `screen_picker`, the `sample` swatch and `btn_shape` with the
  shape's icon. `SHAPE_NONE` hides `btn_shape`.
- `mode_hbc`: the RGB, HSV and Linear toggle Buttons and `btn_mode`. OKHSL has no button. Each
  mode Button draws `TabContainer`'s `tab_unselected` and `tab_selected` boxes, which the picker
  pushes onto it (`color_picker.cpp:154-160,2060-2063`).
- `slider_gc`, a GridContainer of a Label, an HSlider and a SpinBox for each channel, intensity
  and alpha. Each channel and the alpha slider take `bar_arrow` as their grabber, with
  `grabber_offset` and `center_slider_grabbers` (`color_picker.cpp:146-149,629-653`), and draw the
  mode's gradient over their HSlider chrome. An RGB, Linear or OKHSL H row draws its gradient
  from a 400-texel texture, blended in sRGB, linear sRGB or OKLab (`color_mode.cpp:100-120,428-457`).
  Intensity keeps the HSlider's own grabber.
- `hex_hbc`: `hex_label`, `text_type` and the `c_text` LineEdit. For an HDR or negative `color`,
  `text_type` shows the disabled `color_script` icon in place of "#" (`color_picker.cpp:1319-1327`).
- `swatches_vbc`: the "Swatches" toggle with `folded_arrow` and `menu_btn`, then the "Recent
  Colors" toggle. Presets arrive only through `add_preset()` at runtime, so both preset rows stay
  hidden.

The picker's minimum size is the combined minimum of `internal_margin`, as a VBoxContainer's is.
Each internal Control is a CanvasItem of its own. It draws with its own material and light mask,
not the picker's, and the picker's `self_modulate` tints none of them.
The default-theme icons are Godot's own ThorVG rasters at theme scale 1, so their anti-aliased
edges match. At another `gui/theme/default_theme_scale` the browser rasters the scaled SVG, so
the edge pixels differ by a rim.

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

- **Not drawn** Focus rings (`draw_focus_rect`/`draw_focus_circle`): a static previewer
  has no focus.
