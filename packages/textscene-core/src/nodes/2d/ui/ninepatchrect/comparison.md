---
type: NinePatchRect
category: 2D
status: unimplemented
fixture: unit-nine-patch-rect.tscn
# image: unit-nine-patch-rect
renders_as: nothing yet - not implemented
---

# NinePatchRect

NinePatchRect displays a texture as a 9-slice, keeping its corners intact while
stretching or tiling the edges and centre. The previewer parses and validates it but
does not draw it, so it renders as a transform-only fallback and its children still
show.

## Linting

<!-- lint:begin NinePatchRect -->
Strict parsing format-checks these `NinePatchRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `axis_stretch_horizontal` | enum 0-2 (AXIS_STRETCH_MODE_STRETCH/AXIS_STRETCH_MODE_TILE/AXIS_STRETCH_MODE_TILE_FIT) | warning |
| `axis_stretch_vertical` | enum 0-2 (AXIS_STRETCH_MODE_STRETCH/AXIS_STRETCH_MODE_TILE/AXIS_STRETCH_MODE_TILE_FIT) | warning |
| `draw_center` | true or false |  |
| `patch_margin_bottom` | integer 0-16384 | warning |
| `patch_margin_left` | integer 0-16384 | warning |
| `patch_margin_right` | integer 0-16384 | warning |
| `patch_margin_top` | integer 0-16384 | warning |
| `region_rect` | Rect2(x, y, w, h), or the Rect2i spelling Godot converts |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl`, which has no field for `patch_margin_*`,
`axis_stretch_*`, `draw_center`, `region_rect` or `texture`. A bad value on any of them
is never read, so no fallback applies.

## Known limitations

- **Not drawn** Godot draws the sliced texture. The previewer draws nothing for this
  node.
