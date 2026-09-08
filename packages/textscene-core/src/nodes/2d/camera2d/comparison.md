---
type: Camera2D
category: 2D
status: unreviewed
fixture: unit-sub-viewport-container-camera-2d.tscn
# image: unit-sub-viewport-container-camera-2d
renders_as: a 2D view frame with no drawn geometry
---

# Camera2D

Camera2D defines which slice of the canvas the viewport shows, and the previewer draws
no geometry for it. A sub-viewport's 2D pass frames through it, while the main 2D stage
frames the whole scene (ADR-0006).

## Linting

<!-- lint:begin Camera2D -->
Strict parsing format-checks these `Camera2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `anchor_mode` | enum 0-1 (FIXED_TOP_LEFT/DRAG_CENTER) | warning |
| `drag_bottom_margin` | float 0-1 | warning |
| `drag_horizontal_enabled` | true or false |  |
| `drag_horizontal_offset` | float -1-1 | warning |
| `drag_left_margin` | float 0-1 | warning |
| `drag_right_margin` | float 0-1 | warning |
| `drag_top_margin` | float 0-1 | warning |
| `drag_vertical_enabled` | true or false |  |
| `drag_vertical_offset` | float -1-1 | warning |
| `editor_draw_drag_margin` | true or false |  |
| `editor_draw_limits` | true or false |  |
| `editor_draw_screen` | true or false |  |
| `enabled` | true or false |  |
| `ignore_rotation` | true or false |  |
| `limit_bottom` | integer |  |
| `limit_enabled` | true or false |  |
| `limit_left` | integer |  |
| `limit_right` | integer |  |
| `limit_smoothed` | true or false |  |
| `limit_top` | integer |  |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `position_smoothing_enabled` | true or false |  |
| `position_smoothing_speed` | float >= 0 | error below |
| `process_callback` | enum 0-1 (PHYSICS/IDLE) | warning |
| `rotation_smoothing_enabled` | true or false |  |
| `rotation_smoothing_speed` | float >= 0 | error below |
| `zoom` | Vector2(x, y), neither component (near-)zero |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-camera2d-properties` | `camera2d-multiple-enabled` | info |
|  | `camera2d-invalid-horizontal-limits` | info |
|  | `camera2d-invalid-vertical-limits` | info |
|  | `camera2d-smoothing-speed-zero` | info |
|  | `camera2d-rotation-smoothing-speed-zero` | info |
<!-- lint:end -->

`zoom` falls back to `(1, 1)` only when absent or ungrammatical, so a zero or negative
component that strict rejects renders as authored. `anchor_mode` falls back to
`DRAG_CENTER`, the four `limit_*` keys to plus or minus `10000000`, `limit_enabled` to
`true` and `offset` to `(0, 0)`. `enabled` is `true` unless the value reads as `false`.
The smoothing, drag and `editor_draw_*` keys are never read.

## Known limitations

- **Approximated** The main 2D stage frames the whole scene rather than the enabled
  camera's view. Only a SubViewportContainer surface frames through the camera.
