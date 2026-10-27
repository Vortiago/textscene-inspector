---
type: Camera3D
category: 3D
status: done
fixture: unit-camera3d.tscn
image: unit-camera3d
renders_as: Godot's editor frustum gizmo, drawn for every camera
---

# Camera3D

An authored viewpoint that draws nothing at runtime. The previewer matches that, so a capture with the Gizmos toggle off shows no camera in either image. With the toggle on, the previewer draws Godot's editor gizmo (`camera_3d_gizmo_plugin.cpp:139-258`) for every camera, in `Color(0.8, 0.4, 0.8)`, faint while the camera is not selected (ADR-0056).

The gizmo is a pyramid for a perspective camera, two quads for an orthogonal one and a shifted pyramid for a frustum one. It sits on the node, which `h_offset` and `v_offset` do not move. It takes the aspect of the viewport that the previewer fits the camera to.

## Linting

<!-- lint:begin Camera3D -->
Strict parsing format-checks these `Camera3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `attributes` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `compositor` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `cull_mask` | 32-bit layer mask (layers 1-32) |  |
| `current` | true or false |  |
| `doppler_tracking` | enum 0-2 (DISABLED/IDLE_STEP/PHYSICS_STEP) | warning |
| `environment` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `far` | float >= 0.01 | warning below |
| `fov` | float 1-179 | error |
| `frustum_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `h_offset` | float |  |
| `keep_aspect` | enum 0-1 (KEEP_WIDTH/KEEP_HEIGHT) | warning |
| `near` | float >= 0.001 | warning below |
| `projection` | enum 0-2 (PERSPECTIVE/ORTHOGONAL/FRUSTUM) | error |
| `size` | float >= 0.001 | error at or below 0.00001, warning below 0.001 |
| `v_offset` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-camera3d-properties` (type-family match) | `camera3d-multiple-current` | info |
|  | `camera3d-invalid-clipping-planes` | error |
|  | `camera3d-zero-depth-range` | warning |
<!-- lint:end -->

The numeric keys (`fov`, `size`, `near`, `far`, `h_offset`, `v_offset`, `frustum_offset`) warn and fall back to Godot's defaults through `floatOr` and `vec2Or`, and `cull_mask` and `doppler_tracking` to `1048575` and `0`. `projection` and `keep_aspect` silently treat any unrecognised value as the default. `current` reads every spelling a BOOL slot converts, so `1` makes the camera current. Text no BOOL slot reads leaves the camera inactive without a warning.

## Known limitations

- **Editor only** The frustum gizmo appears only in Godot's editor, and here it draws for every camera when the Gizmos toggle is on.