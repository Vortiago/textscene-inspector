---
type: TextureProgressBar
category: 2D
status: unreviewed
fixture: unit-texture-progress-bar.tscn
# image: unit-texture-progress-bar
renders_as: three composited texture layers, the middle one ratio-windowed
---

# TextureProgressBar

TextureProgressBar draws `texture_under`, `texture_progress` and `texture_over` in that
order. `texture_progress` windows to the current ratio: a crop for a linear `fill_mode`,
a triangle fan for a radial one, or a 9-patch grid once `nine_patch_stretch` is set (which
also windows `texture_under`/`texture_over` at full size). Each layer multiplies its own
`tint_*` onto the node's tint.

## Linting

<!-- lint:begin TextureProgressBar -->
Strict parsing format-checks these `TextureProgressBar` properties, plus 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `fill_mode` | enum 0-8 (FILL_LEFT_TO_RIGHT/FILL_RIGHT_TO_LEFT/FILL_TOP_TO_BOTTOM/FILL_BOTTOM_TO_TOP/FILL_CLOCKWISE/FILL_COUNTER_CLOCKWISE/FILL_BILINEAR_LEFT_AND_RIGHT/FILL_BILINEAR_TOP_AND_BOTTOM/FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE) | error |
| `nine_patch_stretch` | true or false |  |
| `radial_center_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `radial_fill_degrees` | float 0-360 | error |
| `radial_initial_angle` | float 0-360 | error |
| `stretch_margin_bottom` | integer 0-16384 | warning |
| `stretch_margin_left` | integer 0-16384 | warning |
| `stretch_margin_right` | integer 0-16384 | warning |
| `stretch_margin_top` | integer 0-16384 | warning |
| `texture_over` | null, SubResource("id") or ExtResource("id") |  |
| `texture_progress` | null, SubResource("id") or ExtResource("id") |  |
| `texture_progress_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `texture_under` | null, SubResource("id") or ExtResource("id") |  |
| `tint_over` | Color(r, g, b, a) |  |
| `tint_progress` | Color(r, g, b, a) |  |
| `tint_under` | Color(r, g, b, a) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser reads `fill_mode`, `nine_patch_stretch`, every `radial_*`,
`stretch_margin_*`, `texture_*` and `tint_*` key alongside its Control and Range bases.
A `fill_mode` outside 0-8 draws as `FILL_LEFT_TO_RIGHT`: `set_fill_mode`'s
`ERR_FAIL_INDEX` refuses the out-of-range write, so the node keeps its class-default
mode. `radial_fill_degrees` outside [0, 360] clamps to that range. `radial_initial_angle`
wraps into it, or falls back to `0` when non-finite. Both mirror their own setters.

## Known limitations

- **Approximated** Without `nine_patch_stretch`, the minimum size is the largest of the
  three textures' own sizes. A texture loaded from an image file has no size available at
  solve time, so only an inline texture (an `AtlasTexture` cell, a `GradientTexture2D`)
  contributes; a scene whose three slots are all plain image files floors to `(1, 1)`.
