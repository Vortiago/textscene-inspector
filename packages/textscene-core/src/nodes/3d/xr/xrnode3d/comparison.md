---
type: XRNode3D
category: 3D
status: linter-only
fixture: unit-xr-node-3d.tscn
# image: unit-xr-node-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XRNode3D

The base for XR-tracked nodes. A tracker drives its transform at runtime and it draws nothing itself, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin XRNode3D -->
Strict parsing format-checks these `XRNode3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `pose` | quoted string or &"name" |  |
| `show_when_tracked` | true or false |  |
| `tracker` | quoted string or &"name" |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-xrnode3d` (type-family match) | `xrnode3d-parent-not-xrorigin3d` | warning |
|  | `xrnode3d-no-pose-set` | warning |
<!-- lint:end -->

XRNode3D reuses `parseNode3D`, which reads only `transform` and `visible`. It never looks at `tracker`, `pose` or `show_when_tracked`, so a malformed `tracker = left_hand` with the quotes dropped parses through silently.
