---
type: MultiMeshInstance3D
category: 3D
status: unimplemented
fixture: unit-multi-mesh-instance-3d.tscn
# image: unit-multi-mesh-instance-3d
renders_as: nothing yet, Godot draws a batch of mesh instances, the previewer does not
---

# MultiMeshInstance3D

Instances a `MultiMesh` resource, drawing many copies of one mesh in a single call. The previewer does not draw the batch yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin MultiMeshInstance3D -->
Strict parsing format-checks these `MultiMeshInstance3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `multimesh` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The lenient parser never runs `multimesh`'s validator. Given `multimesh = "res://grass.tres"`, a bare string instead of a resource reference, it stores the string on the node's property bag with no substitution and no warning.

## Known limitations

- **Not drawn** Godot draws every instance in the `multimesh`. Here none appears.
