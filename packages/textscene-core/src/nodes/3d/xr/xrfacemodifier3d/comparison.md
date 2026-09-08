---
type: XRFaceModifier3D
category: 3D
status: linter-only
fixture: unit-xr-face-modifier-3d.tscn
# image: unit-xr-face-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XRFaceModifier3D

Drives a MeshInstance3D's blend shapes from a live XRFaceTracker. It draws nothing of its own, so the previewer renders it as a transform-only group (ADR-0008). The target mesh shows at the blend-shape values the scene file states.

## Linting

<!-- lint:begin XRFaceModifier3D -->
Strict parsing format-checks these `XRFaceModifier3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `face_tracker` | quoted string or &"name" |  |
| `target` | NodePath("path/to/node") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads the node through `parseNode3D`, so a malformed `face_tracker` or `target` is kept as opaque text with no substitution. There is no tracked blend weight to fall back to either way.
