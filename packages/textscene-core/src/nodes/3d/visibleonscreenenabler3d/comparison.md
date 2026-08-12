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

VisibleOnScreenEnabler3D switches another node's `process_mode` on and off as this node's shape
enters and leaves the screen. It draws nothing at runtime in Godot either, so the
previewer rendering it as a transform-only group (ADR-0008) is parity, not a gap:
the absence IS the useful fact.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enable_mode` | `1` / `2` | which `Node.ProcessMode` the target gets while on screen; off screen it is always `PROCESS_MODE_DISABLED` |
| `enable_node_path` | `NodePath("../Target")` | the node whose processing is toggled; an empty path affects nothing |
| `aabb` | `AABB(-1, -1, -1, 2, 2, 2)` | the on-screen test box, inherited from VisibleOnScreenNotifier3D |

## Divergences

None. The node has no runtime visual in Godot, so there is nothing to diverge on.

## Linting

<!-- lint:begin VisibleOnScreenEnabler3D -->
Strict parsing format-checks these `VisibleOnScreenEnabler3D` properties, plus 1 inherited from VisibleOnScreenNotifier3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `enable_mode` | enum 0-2 (ENABLE_MODE_INHERIT/ENABLE_MODE_ALWAYS/ENABLE_MODE_WHEN_PAUSED) | warning |
| `enable_node_path` | NodePath("path/to/node") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reuses the base parser here and keeps every key in
`rawProperties` verbatim, so a malformed `enable_mode` is neither substituted nor
dropped: it survives into the inspector exactly as written while the strict
parser reports it. An out-of-enum `enable_mode` is only a warning, because
`set_enable_mode` bare-assigns it and Godot itself loads the scene.
