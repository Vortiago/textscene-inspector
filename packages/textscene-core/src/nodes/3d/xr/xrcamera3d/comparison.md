---
type: XRCamera3D
category: 3D
status: unreviewed
fixture: unit-xr-camera-3d.tscn
# image: unit-xr-camera-3d
visual: false
renders_as: a selection-gated frustum gizmo, as Camera3D
---

# XRCamera3D

The headset's eye, which XRServer drives from tracking data at runtime. It is a Camera3D, and the previewer treats it as one: the same selection-gated frustum gizmo (ADR-0018) from the same component.

## Linting

<!-- lint:begin XRCamera3D -->
Strict parsing format-checks the inherited set (15 inherited from Camera3D, 17 inherited from Node3D, 10 inherited from Node); `XRCamera3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-camera3d-properties` (type-family match) | `camera3d-multiple-current` | info |
|  | `camera3d-invalid-clipping-planes` | error |
|  | `camera3d-zero-depth-range` | warning |
| `valid-xrcamera3d-parent` | `xrcamera3d-parent-not-xrorigin3d` | warning |
<!-- lint:end -->

XRCamera3D has no `linterParser.ts` of its own, so strict parsing validates whatever Node3D and Camera3D declare. A malformed inherited `transform` is a strict error, while the lenient `parseNode3D` keeps rendering with the identity transform.

## Known limitations

- **Editor only** The frustum gizmo draws only for the selected node, so a plain capture shows nothing for the camera.
