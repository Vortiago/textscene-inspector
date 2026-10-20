---
type: SpringArm3D
category: 3D
status: unimplemented
fixture: unit-spring-arm-3d.tscn
# image: unit-spring-arm-3d
visual: false
renders_as: a transform group with a selection-gated length line, and no placement of its children along the arm
---

# SpringArm3D

Casts along its local Z axis each physics frame and moves its children to the hit point minus a margin. Godot runs that placement each physics frame, and the previewer does not yet (ADR-0045): the children hold their authored transforms.

## Linting

<!-- lint:begin SpringArm3D -->
Strict parsing format-checks these `SpringArm3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `collision_mask` | 32-bit layer mask (layers 1-32) |  |
| `margin` | float |  |
| `shape` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `spring_length` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads `spring_length` on top of the Node3D transform. An unauthored or unreadable key stays `undefined`, not Godot's default, and `inf` and `nan` are kept. The gizmo substitutes `spring_length = 1` where it draws. `collision_mask`, `shape` and `margin` are never read, because they steer the cast that the previewer does not run.

## Gizmo

A selected node draws one segment in the collision debug colour. Godot's source is `spring_arm_3d_gizmo_plugin.cpp:35-54`. The segment runs from the origin to `Vector3(0, 0, 1) * spring_length`.

Godot guards no length. A length of 0 gives a zero-length segment, and a negative length runs along -Z.

An `inf`, `inf_neg` or `nan` length gives the end point `(nan, nan, ±inf)`. A render of Godot 4.6.3 drew no pixel for such a line, so the previewer draws nothing.

## Known limitations

- **Editor only** Godot's editor draws the length line for every spring arm, but here it draws only for the selected node (ADR-0018).
- **Needs runtime** Godot moves each child to `spring_length` along the arm or to the hit point minus `margin`, but here the children hold their authored transforms.
