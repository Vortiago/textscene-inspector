---
type: XRAnchor3D
category: 3D
status: linter-only
fixture: unit-xr-anchor-3d.tscn
# image: unit-xr-anchor-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XRAnchor3D

An AR anchor that maps a real-world location into the game world. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin XRAnchor3D -->
Strict parsing format-checks the inherited set (3 inherited from XRNode3D, 17 inherited from Node3D, 10 inherited from Node); `XRAnchor3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-xrnode3d` (type-family match) | `xrnode3d-parent-not-xrorigin3d` | warning |
|  | `xrnode3d-no-pose-set` | warning |
<!-- lint:end -->

XRAnchor3D reuses `parseNode3D`, which reads only `transform` and `visible`. A malformed inherited `tracker`, say with the quotes dropped, parses through silently, since nothing downstream reads the key.
