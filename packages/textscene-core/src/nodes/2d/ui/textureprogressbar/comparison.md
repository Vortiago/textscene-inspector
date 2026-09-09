---
type: TextureProgressBar
category: 2D
status: unimplemented
fixture: unit-texture-progress-bar.tscn
# image: unit-texture-progress-bar
renders_as: invisible transform-only fallback
---

# TextureProgressBar

TextureProgressBar is a texture-based progress bar that composites up to three textures
across nine fill modes. The previewer parses and validates it but does not draw it, so
it renders as a transform-only fallback and its children still show.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl` unchanged, which has no field for `fill_mode`,
any `radial_*`, `stretch_margin_*`, `texture_*` or `tint_*` key, or Range's own members.
A bad value is dropped silently, and only strict sees the raw key.

## Known limitations

- **Not drawn** Godot draws the three textures and the fill. The previewer draws nothing
  for this node.
