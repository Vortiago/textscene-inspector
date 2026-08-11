---
type: ShapeCast3D
category: 3D
status: linter-only
fixture: unit-shape-cast-3d.tscn
# image: unit-shape-cast-3d
visual: false
renders_as: nothing (a transform-only group)
---

# ShapeCast3D

Sweeps a `Shape3D` from its origin to `target_position` to detect `CollisionObject3D`s, but draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story. Godot draws the swept shape only as an editor gizmo or under the "Visible Collision Shapes" debug flag, so a plain capture shows nothing either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enabled` | `true` | none — gates collision reporting, not drawn |
| `shape` | `SubResource("BoxShape3D_1")` | none — the swept geometry, not drawn |
| `exclude_parent` | `true` | none — collision-query filter, not drawn |
| `target_position` | `Vector3(0, -1, 0)` | none — cast direction and length, not drawn |
| `margin` | `2.0` | none — collision margin, not drawn |
| `max_results` | `32` | none — query result cap, not drawn |
| `collision_mask` | `1` | none — physics layer filter, not drawn |
| `collide_with_areas` | `false` | none — query filter, not drawn |
| `collide_with_bodies` | `true` | none — query filter, not drawn |
| `debug_shape_custom_color` | `Color(0, 0, 0, 1)` | none — editor/debug-overlay tint only, not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin ShapeCast3D -->
Strict parsing format-checks these `ShapeCast3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `collide_with_areas` | true or false |
| `collide_with_bodies` | true or false |
| `collision_mask` | 32-bit layer mask (layers 1-32) |
| `debug_shape_custom_color` | Color(r, g, b, a) |
| `enabled` | true or false |
| `exclude_parent` | true or false |
| `margin` | float 0-100 |
| `max_results` | integer |
| `shape` | null, SubResource("id") or ExtResource("id") |
| `target_position` | Vector3(x, y, z) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-shapecast3d` | `shapecast3d-no-collide-target` | warning |
|  | `shapecast3d-zero-mask` | warning |
|  | `shapecast3d-missing-shape` | warning |
|  | `shapecast3d-unresolved-shape` | error |
|  | `shapecast3d-concave-shape` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only Node3D's own keys, so none of
the properties above reaches `node.properties` at all: a malformed `margin` is
ignored rather than substituted with a default. The raw text survives on
`node.rawProperties`, but nothing reads it back for this type.
