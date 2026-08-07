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

Sweeps a `Shape2D` from its origin to `target_position` to detect `CollisionObject2D`s, but draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story. Godot draws the swept shape only as an editor gizmo or under the "Visible Collision Shapes" debug flag, so a plain capture shows nothing either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enabled` | `true` | none — gates collision reporting, not drawn |
| `shape` | `SubResource("CircleShape2D_1")` | none — the swept geometry, not drawn |
| `exclude_parent` | `true` | none — collision-query filter, not drawn |
| `target_position` | `Vector2(0, 50)` | none — cast direction and length, not drawn |
| `margin` | `2.0` | none — collision margin, not drawn |
| `max_results` | `32` | none — query result cap, not drawn |
| `collision_mask` | `1` | none — physics layer filter, not drawn |
| `collide_with_areas` | `false` | none — query filter, not drawn |
| `collide_with_bodies` | `true` | none — query filter, not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin ShapeCast2D -->
Strict parsing format-checks these `ShapeCast2D` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `collide_with_areas` | true or false |
| `collide_with_bodies` | true or false |
| `collision_mask` | 32-bit layer mask (layers 1-32) |
| `enabled` | true or false |
| `exclude_parent` | true or false |
| `margin` | float 0-100 |
| `max_results` | integer |
| `shape` | SubResource("id") or ExtResource("id") |
| `target_position` | Vector2(x, y) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-shapecast2d` | `shapecast2d-no-collide-target` | warning |
|  | `shapecast2d-zero-mask` | warning |
|  | `shapecast2d-missing-shape` | warning |
|  | `shapecast2d-unresolved-shape` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which reads only Node2D's own keys, so none of
the properties above reaches `node.properties` at all: a malformed `margin` is
ignored rather than substituted with a default. The raw text survives on
`node.rawProperties`, but nothing reads it back for this type.
