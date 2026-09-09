---
type: ImporterMeshInstance3D
category: 3D
status: linter-only
fixture: unit-importer-mesh-instance-3d.tscn
# image: unit-importer-mesh-instance-3d
visual: false
renders_as: nothing (a transform-only group)
---

# ImporterMeshInstance3D

An import-pipeline node that Godot's importer replaces with a real MeshInstance3D before the scene runs, so it draws nothing at runtime. The previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin ImporterMeshInstance3D -->
Strict parsing format-checks these `ImporterMeshInstance3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `cast_shadow` | enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY) | warning |
| `layer_mask` | 32-bit layer mask (layers 1-32) |  |
| `mesh` | null, SubResource("id") or ExtResource("id") |  |
| `skeleton_path` | NodePath("path/to/node") |  |
| `skin` | null, SubResource("id") or ExtResource("id") |  |
| `visibility_range_begin` | float >= 0 | warning below |
| `visibility_range_begin_margin` | float >= 0 | warning below |
| `visibility_range_end` | float >= 0 | warning below |
| `visibility_range_end_margin` | float >= 0 | warning below |
| `visibility_range_fade_mode` | enum 0-2 (DISABLED/SELF/DEPENDENCIES) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

`index.ts` registers the plain `parseNode` reader, which decodes only `transform`. `mesh`, `skin`, `layer_mask`, `cast_shadow` and the `visibility_range_*` keys are never decoded by the lenient parser, and a malformed `transform` warns and substitutes the identity.
