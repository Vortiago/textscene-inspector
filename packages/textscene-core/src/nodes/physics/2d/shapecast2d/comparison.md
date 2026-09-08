---
type: ShapeCast2D
category: 2D
status: linter-only
fixture: unit-shape-cast-2d.tscn
# image: unit-shape-cast-2d
visual: false
renders_as: nothing (a transform-only group)
---

# ShapeCast2D

Sweeps a `Shape2D` from its origin to `target_position` to detect collisions. Godot draws the swept shape only as a debug gizmo, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin ShapeCast2D -->
Strict parsing format-checks these `ShapeCast2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collide_with_areas` | true or false |  |
| `collide_with_bodies` | true or false |  |
| `collision_mask` | 32-bit layer mask (layers 1-32) |  |
| `enabled` | true or false |  |
| `exclude_parent` | true or false |  |
| `margin` | float 0-100 | warning |
| `max_results` | integer |  |
| `shape` | null, SubResource("id") or ExtResource("id") |  |
| `target_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-shapecast2d` | `shapecast2d-no-collide-target` | info |
|  | `shapecast2d-zero-mask` | info |
|  | `shapecast2d-missing-shape` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which reads only Node2D's own keys, so a malformed `margin` is ignored rather than substituted. The raw text survives on `node.rawProperties`, but nothing reads it back.
