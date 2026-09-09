---
type: VisibleOnScreenEnabler3D
category: 3D
status: linter-only
fixture: unit-visible-on-screen-enabler-3d.tscn
# image: unit-visible-on-screen-enabler-3d
visual: false
renders_as: nothing (a transform-only group)
---

# VisibleOnScreenEnabler3D

Switches another node's `process_mode` on and off as this node's box enters and leaves the screen. It draws nothing at runtime in Godot either, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin VisibleOnScreenEnabler3D -->
Strict parsing format-checks these `VisibleOnScreenEnabler3D` properties, plus 1 inherited from VisibleOnScreenNotifier3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `enable_mode` | enum 0-2 (ENABLE_MODE_INHERIT/ENABLE_MODE_ALWAYS/ENABLE_MODE_WHEN_PAUSED) | warning |
| `enable_node_path` | NodePath("path/to/node") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reuses the base parser and keeps every key in `rawProperties` verbatim, so a malformed `enable_mode` is neither substituted nor dropped. It survives into the inspector as written while the strict parser reports it.
