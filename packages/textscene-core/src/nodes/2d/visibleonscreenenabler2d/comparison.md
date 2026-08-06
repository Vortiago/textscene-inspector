---
type: VisibleOnScreenEnabler2D
category: 2D
status: linter-only
fixture: unit-visible-on-screen-enabler-2d.tscn
# image: unit-visible-on-screen-enabler-2d
visual: false
renders_as: nothing (a transform-only group)
---

# VisibleOnScreenEnabler2D

VisibleOnScreenEnabler2D switches another node's `process_mode` on and off as this node's shape
enters and leaves the screen. It draws nothing at runtime in Godot either, so the
previewer rendering it as a transform-only group (ADR-0008) is parity, not a gap:
the absence IS the useful fact.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enable_mode` | `1` / `2` | which `Node.ProcessMode` the target gets while on screen; off screen it is always `PROCESS_MODE_DISABLED` |
| `enable_node_path` | `NodePath("../Target")` | the node whose processing is toggled; an empty path affects nothing |
| `rect` | `Rect2(-20, -20, 40, 40)` | the on-screen test rectangle, inherited from VisibleOnScreenNotifier2D |

## Divergences

None. The node has no runtime visual in Godot, so there is nothing to diverge on.

## Linting

<!-- lint:begin VisibleOnScreenEnabler2D -->
Strict parsing format-checks these `VisibleOnScreenEnabler2D` properties, plus 2 inherited from VisibleOnScreenNotifier2D, 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `enable_mode` | enum 0-2 (ENABLE_MODE_INHERIT/ENABLE_MODE_ALWAYS/ENABLE_MODE_WHEN_PAUSED) |
| `enable_node_path` | NodePath("path/to/node") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

The lenient parser reuses the base parser here and keeps every key in
`rawProperties` verbatim, so a malformed `enable_mode` is neither substituted nor
dropped: it survives into the inspector exactly as written while the strict
parser reports it. An out-of-enum `enable_mode` is only a warning, because
`set_enable_mode` bare-assigns it and Godot itself loads the scene.
