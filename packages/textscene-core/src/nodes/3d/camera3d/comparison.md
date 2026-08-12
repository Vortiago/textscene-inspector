---
type: Camera3D
category: 3D
fixture: unit-camera3d.tscn
image: unit-camera3d
renders_as: a selection-gated frustum gizmo
---

# Camera3D

Camera3D is an authored viewpoint that draws nothing at runtime — Godot renders the game, not
the editor, so the camera is invisible. The previewer matches that: it draws only a frustum
gizmo, and that gizmo is selection-gated (ADR-0018), so with nothing selected it is absent too.
The fixture places three cameras (`MainCamera`, `LeftCamera`, `TopCamera`) among a gray ground
plane and a blue and an orange box; only the reference geometry appears in either capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `current` | `true` (MainCamera) | marks the active camera; no visible effect — Camera3D renders nothing at runtime |
| `fov` | `70.0` / `55.0` / `60.0` | none — the capture is framed by the matched reference camera, not these nodes |
| `transform` | three distinct placements | none — the cameras are invisible |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Camera3D -->
Strict parsing format-checks these `Camera3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `attributes` | null, SubResource("id") or ExtResource("id") |  |
| `compositor` | null, SubResource("id") or ExtResource("id") |  |
| `cull_mask` | 32-bit layer mask (layers 1-32) | warning |
| `current` | true or false |  |
| `doppler_tracking` | enum 0-2 (DISABLED/IDLE_STEP/PHYSICS_STEP) | warning |
| `environment` | null, SubResource("id") or ExtResource("id") |  |
| `far` | float |  |
| `fov` | float 1-179 | error |
| `frustum_offset` | Vector2(x, y) |  |
| `h_offset` | float |  |
| `keep_aspect` | enum 0-1 (KEEP_WIDTH/KEEP_HEIGHT) | warning |
| `near` | float |  |
| `projection` | enum 0-2 (PERSPECTIVE/ORTHOGONAL/FRUSTUM) | error |
| `size` | float > 0 | error |
| `v_offset` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-camera3d-properties` (type-family match) | `camera3d-invalid-clipping-planes` | error |
|  | `camera3d-small-near-plane` | warning |
|  | `camera3d-small-far-plane` | warning |
<!-- lint:end -->

Numeric fields (`fov`, `size`, `near`, `far`, `h_offset`, `v_offset`, `frustum_offset`) fall back through `floatOr`/`vec2Or`, warning and substituting Godot's defaults (75° fov, size 1, near 0.05, far 4000, zero offsets) on a malformed value; `cull_mask` and `doppler_tracking` fall back the same way to 1048575 and 0. `projection` and `keep_aspect` bypass that contract: any value other than the recognized ints (1/2 for projection, 0/2 for keep_aspect) is silently treated as the default (PERSPECTIVE, KEEP_HEIGHT) with no warning logged. `current` reads via plain string equality (`=== 'true'`) rather than `boolOr`, so anything but the literal string "true", including "1", renders the camera inactive without comment.
