---
type: Camera3D
category: 3D
status: unreviewed
fixture: unit-camera3d.tscn
image: unit-camera3d
renders_as: a selection-gated frustum gizmo
---

# Camera3D

An authored viewpoint that draws nothing at runtime. The previewer matches that and draws only a frustum gizmo, which is selection-gated (ADR-0018), so with nothing selected the camera is absent from both images.

## Linting

<!-- lint:begin Camera3D -->
Strict parsing format-checks these `Camera3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `attributes` | null, SubResource("id") or ExtResource("id") |  |
| `compositor` | null, SubResource("id") or ExtResource("id") |  |
| `cull_mask` | 32-bit layer mask (layers 1-32) |  |
| `current` | true or false |  |
| `doppler_tracking` | enum 0-2 (DISABLED/IDLE_STEP/PHYSICS_STEP) | warning |
| `environment` | null, SubResource("id") or ExtResource("id") |  |
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
| `valid-camera3d-properties` (type-family match) | `camera3d-invalid-clipping-planes` | error |
|  | `camera3d-zero-depth-range` | warning |
<!-- lint:end -->

The numeric keys (`fov`, `size`, `near`, `far`, `h_offset`, `v_offset`, `frustum_offset`) warn and fall back to Godot's defaults through `floatOr` and `vec2Or`, and `cull_mask` and `doppler_tracking` to `1048575` and `0`. `projection` and `keep_aspect` silently treat any unrecognised value as the default. `current` is a raw `=== 'true'` comparison, so `"1"` leaves the camera inactive.

## Known limitations

- **Editor only** The frustum gizmo appears only in Godot's editor. Here it is selection-gated.
