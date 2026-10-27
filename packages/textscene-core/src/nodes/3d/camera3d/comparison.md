---
type: Camera3D
category: 3D
status: done
fixture: unit-camera3d.tscn
image: unit-camera3d
renders_as: a frustum gizmo for the selected node
---

# Camera3D

An authored viewpoint that draws nothing at runtime. The previewer matches that and draws only a frustum gizmo for the selected node (ADR-0056). With nothing selected, the camera is absent from both images.

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

## Exposure

While the viewer looks through a Camera3D, or a sub-viewport elects it, the exposure factor of its `attributes` replaces the one of the world (`renderer_scene_cull.cpp:3562-3565`). A camera with no valid `attributes` leaves the world's exposure in force. The WorldEnvironment sheet lists what the factor scales.

## Known limitations

- **Not drawn** A CameraAttributesPhysical does not set the `fov`, `near` and `far` of its camera (`camera_3d.cpp:565-567`), and its depth of field does not draw.
- **Not drawn** The `attributes` of a Camera3D in a SubViewport that shares the root world do not scale that SubViewport's texture. The pass draws the one scene at the exposure of the root world, and Godot scales it by the exposure of the camera the SubViewport renders through (`renderer_scene_cull.cpp:2707`).
- **Editor only** The frustum gizmo appears only in Godot's editor, and here it draws for the selected node when the Gizmos toggle is on.
