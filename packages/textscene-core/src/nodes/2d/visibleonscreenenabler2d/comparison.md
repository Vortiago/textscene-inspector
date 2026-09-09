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

Switches another node's `process_mode` on and off as its `rect` enters and leaves the screen. It draws nothing at runtime in Godot either, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin VisibleOnScreenEnabler2D -->
Strict parsing format-checks these `VisibleOnScreenEnabler2D` properties, plus 2 inherited from VisibleOnScreenNotifier2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `enable_mode` | enum 0-2 (ENABLE_MODE_INHERIT/ENABLE_MODE_ALWAYS/ENABLE_MODE_WHEN_PAUSED) | warning |
| `enable_node_path` | NodePath("path/to/node") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

The lenient parser reuses the base parser and keeps every key in `rawProperties` verbatim. A malformed `enable_mode` is neither substituted nor dropped, so it reaches the inspector exactly as written while strict reports it.
