---
type: RayCast2D
category: 2D
status: linter-only
fixture: unit-ray-cast-2d.tscn
# image: unit-ray-cast-2d
visual: false
renders_as: nothing (a transform-only group)
---

# RayCast2D

Casts a ray each physics frame toward `target_position` and reports the first hit. Godot draws the ray only as a debug line, so the previewer renders it as a transform-only group (ADR-0008).

## Linting

<!-- lint:begin RayCast2D -->
Strict parsing format-checks these `RayCast2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collide_with_areas` | true or false |  |
| `collide_with_bodies` | true or false |  |
| `collision_mask` | 32-bit layer mask (layers 1-32) |  |
| `enabled` | true or false |  |
| `exclude_parent` | true or false |  |
| `hit_from_inside` | true or false |  |
| `target_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-raycast2d` | `raycast2d-no-collide-target` | info |
|  | `raycast2d-zero-mask` | info |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which reads only Node2D's transform keys, so a malformed `collision_mask` or a non-boolean `hit_from_inside` is ignored rather than substituted.
