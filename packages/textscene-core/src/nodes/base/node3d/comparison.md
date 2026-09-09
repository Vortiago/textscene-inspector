---
type: Node3D
category: 3D
status: linter-only
fixture: unit-node3d-basic.tscn
image: unit-node3d-basic
visual: false
renders_as: an invisible transform group
---

# Node3D

The base 3D node: a pure transform with no geometry of its own. The previewer renders it as a `<group>` that positions its children, decomposing each `Transform3D` into position, rotation and scale. Both captures show only the preview sky.

## Linting

<!-- lint:begin Node3D -->
Strict parsing format-checks these `Node3D` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `basis` | Basis(9 floats) |  |
| `global_basis` | Basis(9 floats) |  |
| `global_position` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `global_rotation` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `global_rotation_degrees` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `global_transform` | Transform3D(12 floats) |  |
| `position` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `quaternion` | Quaternion(x, y, z, w) |  |
| `rotation` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `rotation_degrees` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `rotation_edit_mode` | enum 0-2 (Euler/Quaternion/Basis) | warning |
| `rotation_order` | enum 0-5 (XYZ/XZY/YXZ/YZX/ZXY/ZYX) | error |
| `scale` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `top_level` | true or false |  |
| `transform` | Transform3D(12 floats) |  |
| `visibility_parent` | NodePath("path/to/node") |  |
| `visible` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads exactly two properties, `transform` and `visible`. A malformed `transform` warns and falls back to the identity, and `visible` resolves through plain string equality with no warning. `position`, `rotation`, `scale`, `basis`, `quaternion` and the `global_*` fields are never read, so only the composite `Transform3D` literal places a node.

## Known limitations

- **Approximated** `top_level = true` is not honoured. Every node nests in its parent's group, so the parent transform is always inherited.
