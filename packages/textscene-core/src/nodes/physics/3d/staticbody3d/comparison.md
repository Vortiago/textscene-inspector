---
type: StaticBody3D
category: 3D
status: linter-only
fixture: unit-physics-bodies.tscn
image: unit-physics-bodies
renders_as: a transform-only group
---

# StaticBody3D

StaticBody3D is a non-moving physics body with no runtime visual of its own. The
previewer mounts it as a transform-only Node3D group (ADR-0005), so it draws
nothing directly — but it is the parent of the blue slab both images show: its
child `GroundMesh` (a MeshInstance3D with a flat 2×0.4×2 BoxMesh and a blue
`albedo_color`). Its other child, `GroundCollision`, is a toggle-gated collision
overlay (ADR-0005/0006) and stays hidden in a plain capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| (none) | — | the `Ground` StaticBody3D sets no properties; the visible box is its child MeshInstance3D |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin StaticBody3D -->
Strict parsing format-checks these `StaticBody3D` properties, plus 6 inherited from CollisionObject3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `constant_angular_velocity` | Vector3(x, y, z) |
| `constant_linear_velocity` | Vector3(x, y, z) |
| `physics_material_override` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-staticbody3d` (type-family match) | `valid-staticbody3d-resources` | error |
|  | `staticbody3d-needs-collision-shape` | warning |
<!-- lint:end -->

StaticBody3D has no `parser.ts`: it reuses `parseNode3D` directly, so none of
the strict-validated properties (`physics_material_override`,
`constant_linear_velocity`/`constant_angular_velocity`,
`collision_layer`/`collision_mask`, `disable_mode`, `input_ray_pickable`) are
read by the lenient parser. The node renders as a transform-only group, so
there's no substitution to describe.
