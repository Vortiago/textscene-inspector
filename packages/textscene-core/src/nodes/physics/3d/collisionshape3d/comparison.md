---
type: CollisionShape3D
category: 3D
fixture: unit-rigidbody3d.tscn
image: unit-rigidbody3d
renders_as: a toggle-gated collision wireframe
---

# CollisionShape3D

CollisionShape3D attaches a collision shape to a physics body and has no visible
form at runtime. Its wireframe draws only when "Visible Collision Shapes" is enabled
(ADR-0005 / ADR-0006), which is off in this capture, so the previewer draws nothing
for it here. The salmon cube on screen is the sibling `CrateMesh` (a MeshInstance3D)
under the same RigidBody3D.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `shape` | `BoxShape3D` (size 1×1×1) | the collision volume; drawn only as a gated wireframe box, so absent from this capture |

## Divergences

None visible in this fixture. The CollisionShape3D wireframe is toggle-gated and so
appears in neither capture, and the sibling crate sits at its authored pose, colour,
and shading identically on both sides.

## Linting

<!-- lint:begin CollisionShape3D -->
Strict parsing format-checks these `CollisionShape3D` properties, plus 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `debug_color` | Color(r, g, b, a) |
| `debug_fill` | true or false |
| `disabled` | true or false |
| `shape` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-collisionshape3d` | `collisionshape3d-requires-shape` | warning |
|  | `valid-collisionshape3d-resources` | error |
|  | `collisionshape3d-invalid-parent` | warning |
|  | `collisionshape3d-no-parent` | warning |
|  | `collisionshape3d-non-uniform-scale` | warning |
|  | `collisionshape3d-concave-under-rigidbody` | warning |
|  | `collisionshape3d-worldboundary-under-rigidbody` | warning |
|  | `collisionshape3d-concave-under-characterbody` | warning |
<!-- lint:end -->

`shape` is copied through verbatim whenever present, with no format check.
`disabled` is set to `properties.disabled === 'true'`, so any non-`'true'`
string silently becomes `false`. `debug_color` goes through
`parseDebugColor`/`colorOr`, falling back to the project default
`Color(0, 0.6, 0.7, 0.42)` for both an absent and an unparseable value, with
no warning either way.
