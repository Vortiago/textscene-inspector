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
Strict parsing format-checks these `Camera3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `cull_mask` |
| `current` |
| `doppler_tracking` |
| `far` |
| `fov` |
| `frustum_offset` |
| `h_offset` |
| `keep_aspect` |
| `near` |
| `projection` |
| `size` |
| `v_offset` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-camera3d-properties` | `camera3d-invalid-clipping-planes` | error |
|  | `camera3d-small-near-plane` | warning |
|  | `camera3d-large-far-plane` | warning |
|  | `camera3d-extreme-fov` | warning |
<!-- lint:end -->

Numeric fields (`fov`, `size`, `near`, `far`, `h_offset`, `v_offset`, `frustum_offset`) fall back through `floatOr`/`vec2Or`, warning and substituting Godot's defaults (75° fov, size 1, near 0.05, far 4000, zero offsets) on a malformed value; `cull_mask` and `doppler_tracking` fall back the same way to 1048575 and 0. `projection` and `keep_aspect` bypass that contract: any value other than the recognized ints (1/2 for projection, 0/2 for keep_aspect) is silently treated as the default (PERSPECTIVE, KEEP_HEIGHT) with no warning logged. `current` reads via plain string equality (`=== 'true'`) rather than `boolOr`, so anything but the literal string "true", including "1", renders the camera inactive without comment.
