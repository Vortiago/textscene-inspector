---
type: TextureProgressBar
category: 2D
status: unimplemented
fixture: unit-texture-progress-bar.tscn
# image: unit-texture-progress-bar
renders_as: invisible transform-only fallback
---

# TextureProgressBar

TextureProgressBar is Range's texture-based progress bar, compositing up to 3
textures across 9 fill modes (4 linear, 2 bilinear, 3 radial) instead of using
Godot's Theme resource. The previewer parses and validates every member below
but does not draw it yet: it renders as an invisible transform-only fallback
and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `fill_mode` | `4` (`FILL_CLOCKWISE`) | turns the bar into a radial wipe, making `radial_*` meaningful |
| `nine_patch_stretch` | `true` | treats the textures like a `NinePatchRect`, using the `stretch_margin_*` grid |
| `radial_center_offset` | `Vector2(2, 3)` | offsets the radial wipe's centre within `texture_progress` |
| `radial_fill_degrees` | `270.0` | the angle `texture_progress` fills to at `max_value` |
| `radial_initial_angle` | `45.0` | the angle `texture_progress` starts filling from at `min_value` |
| `stretch_margin_bottom` / `_left` / `_right` / `_top` | `4` each | the nine-patch's 3x3 grid margins, in pixels |
| `texture_over` | a `PlaceholderTexture2D` | draws over the bar, for highlights or a frame |
| `texture_progress` | a `PlaceholderTexture2D` | clips by `value`/`fill_mode`; the bar itself |
| `texture_progress_offset` | `Vector2(1, 1)` | offsets `texture_progress` relative to `texture_under`/`texture_over` |
| `texture_under` | a `PlaceholderTexture2D` | draws under the bar; its background |
| `tint_over` | `Color(1, 0.8, 0.8, 1)` | multiplies `texture_over`'s color |
| `tint_progress` | `Color(0.8, 1, 0.8, 1)` | multiplies `texture_progress`'s color |
| `tint_under` | `Color(0.8, 0.8, 1, 1)` | multiplies `texture_under`'s color |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

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

The lenient parser reuses `parseControl` unchanged for this node, and `parseControl`
reads only Control/CanvasItem fields (anchors, offsets, modulate, theme overrides): it
has no field for `fill_mode`, any `radial_*`/`stretch_margin_*`/`texture_*`/`tint_*` key,
or Range's own members. So a bad value in any of those — `fill_mode = 12`, an enum
index past `FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE`, or a malformed `Color(...)` — is
silently dropped by the lenient parser: `parseControl` never reads the key at all, so
the node still parses as `TextureProgressBar` with its children intact and no trace of
the bad value survives into the parsed result. StrictTscnParser sees the same raw key
and value straight from the scanning loop, independent of `parseControl`, which is why
the validators above catch what the lenient path silently drops.
