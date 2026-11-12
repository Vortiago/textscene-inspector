---
type: MultiMeshInstance3D
category: 3D
status: unreviewed
fixture: unit-multi-mesh-instance-3d-instances.tscn
image: unit-multi-mesh-instance-3d-instances
renders_as: a THREE.InstancedMesh of the MultiMesh's mesh
---

# MultiMeshInstance3D

Instances a `MultiMesh` resource, drawing many copies of one mesh in a single call. The previewer draws the mesh once for each visible instance, with the instance transform and colour.

## Linting

<!-- lint:begin MultiMeshInstance3D -->
Strict parsing format-checks these `MultiMeshInstance3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `multimesh` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The scene cull measures the node by its MultiMesh's box: the `custom_aabb`, or the mesh's box under each instance transform. So its visibility range still decides its visibility dependants.

The lenient parser never runs `multimesh`'s validator. Given `multimesh = "res://grass.tres"`, a bare string instead of a resource reference, it stores the string on the node's property bag with no substitution and no warning.

## Known limitations

- **Shader missing** A ShaderMaterial is not translated, so a custom shader never reads `INSTANCE_CUSTOM`, which a StandardMaterial3D flipbook does.
