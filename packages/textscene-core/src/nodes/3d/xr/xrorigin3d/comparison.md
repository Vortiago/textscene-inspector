---
type: XROrigin3D
category: 3D
status: linter-only
fixture: unit-xr-origin-3d.tscn
# image: unit-xr-origin-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XROrigin3D

Maps the real-world tracking-space centre into the game world. Every XRCamera3D, XRController3D and XRAnchor3D should sit under it. It draws nothing itself, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin XROrigin3D -->
Strict parsing format-checks these `XROrigin3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `current` | true or false |  |
| `world_scale` | float 0.01-1000 | error below 0.01, error above 1000 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-xrorigin3d` | `xrorigin3d-missing-camera-child` | warning |
|  | `xrorigin3d-unsupported-scale` | warning |
<!-- lint:end -->

The `xrorigin3d-missing-camera-child` rule stays silent when a child's class lives elsewhere.
An `instance=` node, or a class the pinned catalog does not list, may be an XRCamera3D.

`world_scale` is clamped to `[0.01, 1000]` by `XRServer::set_world_scale`, so a value past the clamp is a strict error. The lenient `parseNode3D` never reads `world_scale` or `current`, so a malformed or out-of-range value parses through silently.
