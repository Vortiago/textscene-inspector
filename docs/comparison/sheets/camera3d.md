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
