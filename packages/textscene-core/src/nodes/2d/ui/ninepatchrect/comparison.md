---
type: NinePatchRect
category: 2D
status: unimplemented
fixture: unit-nine-patch-rect.tscn
# image: unit-nine-patch-rect
renders_as: nothing yet - not implemented
---

# NinePatchRect

NinePatchRect (9-slice) displays a texture by keeping its corners intact while tiling its edges and center; the previewer parses and validates it but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `axis_stretch_horizontal` | `1` | Horizontal stretch mode: tile instead of stretch the center/edges. |
| `axis_stretch_vertical` | `2` | Vertical stretch mode: tile-fit. |
| `draw_center` | `false` | Only the border is drawn; the center patch is skipped. |
| `patch_margin_bottom` | `8` | Bottom row of the 9-slice is 8px tall. |
| `patch_margin_left` | `8` | Left column of the 9-slice is 8px wide. |
| `patch_margin_right` | `8` | Right column of the 9-slice is 8px wide. |
| `patch_margin_top` | `8` | Top row of the 9-slice is 8px tall. |
| `region_rect` | `Rect2(0, 0, 32, 32)` | Samples the whole 32x32 placeholder texture. |
| `texture` | `SubResource("PlaceholderTexture2D_1")` | The 9-slice source texture. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin NinePatchRect -->
Strict parsing format-checks these `NinePatchRect` properties, plus 28 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `axis_stretch_horizontal` | enum 0-2 (AXIS_STRETCH_MODE_STRETCH/AXIS_STRETCH_MODE_TILE/AXIS_STRETCH_MODE_TILE_FIT) |
| `axis_stretch_vertical` | enum 0-2 (AXIS_STRETCH_MODE_STRETCH/AXIS_STRETCH_MODE_TILE/AXIS_STRETCH_MODE_TILE_FIT) |
| `draw_center` | true or false |
| `patch_margin_bottom` | integer 0-16384 |
| `patch_margin_left` | integer 0-16384 |
| `patch_margin_right` | integer 0-16384 |
| `patch_margin_top` | integer 0-16384 |
| `region_rect` | Rect2(x, y, w, h) |
| `texture` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl`, which only extracts Control's own known
keys (anchors, offsets, modulate, and so on) into typed fields; it has no field for
`patch_margin_*`, `axis_stretch_*`, `draw_center`, `region_rect` or `texture`, so a
bad value on any of them (an out-of-range patch margin, an unknown axis-stretch
mode) is simply never read rather than substituted or clamped. There is no
lenient-side fallback for the strict parser's warnings to diverge from.
