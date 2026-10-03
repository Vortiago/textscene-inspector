---
type: SpringArm3D
category: 3D
status: unimplemented
fixture: unit-spring-arm-3d.tscn
# image: unit-spring-arm-3d
visual: false
renders_as: nothing yet, Godot places its children along the arm each physics frame, the previewer does not
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

SpringArm3D registers `parseNode3D` directly, so `collision_mask`, `shape`, `spring_length` and `margin` are never read. An out-of-range `collision_mask` or a non-numeric `spring_length` is dropped rather than substituted or warned on.

## Known limitations

- **Needs runtime** Godot moves each child to `spring_length` along the arm or to the hit point minus `margin`, but here the children hold their authored transforms.
