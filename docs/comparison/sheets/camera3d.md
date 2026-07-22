---
type: Camera3D
category: 3D
fixture: unit-decal.tscn
image: unit-decal
renders_as: a passive THREE.PerspectiveCamera
---

# Camera3D

Camera3D is the scene's authored viewpoint, but it is a passive scene-tree node in this
capture: both images are framed from Godot's editor camera (`Node3DEditorViewport::Cursor`,
matched on both sides), not from this node, so the fixture's `transform` and `fov` have no
effect on what either render shows. The previewer builds a passive `THREE.PerspectiveCamera`
that only becomes the viewport through the camera switcher, plus a frustum gizmo that is
selection-gated — so the node draws nothing in either image.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | origin `(0, 4, 6)`, tilted ~30° down | none here — the editor camera frames the capture, not this node |
| `fov` | `70.0` | none here — as above |

## Divergences

None visible in this fixture.
