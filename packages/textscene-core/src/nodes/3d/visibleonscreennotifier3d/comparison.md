---
type: VisibleOnScreenNotifier3D
category: 3D
status: linter-only
fixture: unit-visible-on-screen-notifier-3d.tscn
# image: unit-visible-on-screen-notifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# VisibleOnScreenNotifier3D

Reports whether its `aabb` is on screen through `screen_entered` and `screen_exited` signals. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008). Unlike its 2D sibling, this class has no draw call at all.

## Linting

<!-- lint:begin VisibleOnScreenNotifier3D -->
Strict parsing format-checks these `VisibleOnScreenNotifier3D` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `aabb` | AABB(x, y, z, w, h, d) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser (`parseNode3D`) never reads `aabb`, so a malformed value is ignored rather than substituted or reported. `layers` is inherited from VisualInstance3D and is covered on that sheet.
