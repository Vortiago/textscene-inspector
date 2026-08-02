---
type: RayCast3D
category: 3D
status: linter-only
fixture: unit-ray-cast-3d.tscn
# image: unit-ray-cast-3d
visual: false
renders_as: nothing (a transform-only group)
---

# RayCast3D

This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enabled` | `true` | ray updates automatically each physics frame |
| `exclude_parent` | `false` | ray does not ignore its parent body |
| `target_position` | `Vector3(0, -3, 0)` | how far and which direction the ray reaches |
| `collision_mask` | `3` | which physics layers the ray can hit |
| `hit_from_inside` | `true` | ray detects shapes it starts inside |
| `hit_back_faces` | `false` | ray ignores back faces of concave/heightmap shapes |
| `collide_with_areas` | `true` | ray can report Area3D hits |
| `collide_with_bodies` | `true` | ray can report PhysicsBody3D hits |
| `debug_shape_custom_color` | `Color(1, 0, 0, 1)` | tints the editor/debug gizmo only |
| `debug_shape_thickness` | `3` | sizes the editor/debug gizmo only |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin RayCast3D -->
Strict parsing format-checks these `RayCast3D` properties, plus 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `collide_with_areas` | true or false |
| `collide_with_bodies` | true or false |
| `collision_mask` | 32-bit layer mask (layers 1-32) |
| `debug_shape_custom_color` | Color(r, g, b, a) |
| `debug_shape_thickness` | integer 1-5 |
| `enabled` | true or false |
| `exclude_parent` | true or false |
| `hit_back_faces` | true or false |
| `hit_from_inside` | true or false |
| `target_position` | Vector3(x, y, z) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-raycast3d` | `raycast3d-no-collide-target` | warning |
|  | `raycast3d-zero-mask` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D` unmodified, and that function only
pulls `transform` and `visible` off the raw property bag — so a bad value on
any of RayCast3D's own ten properties (say `collision_mask = "all"` or
`target_position = Vector3(0, -1)`) is never even read, let alone substituted
or defaulted. Strict linting is the only path that ever looks at them.
