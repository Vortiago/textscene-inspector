---
type: MultiMeshInstance2D
category: 2D
status: unimplemented
fixture: unit-multi-mesh-instance-2d.tscn
# image: unit-multi-mesh-instance-2d
renders_as: nothing yet, Godot draws a batch of textured mesh instances, the previewer does not
---

# MultiMeshInstance2D

MultiMeshInstance2D batch-draws many copies of one mesh from a MultiMesh resource. The
previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

## Linting

<!-- lint:begin MultiMeshInstance2D -->
Strict parsing format-checks these `MultiMeshInstance2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `multimesh` | null, SubResource("id") or ExtResource("id") |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

A bare string in `multimesh` or `texture`, such as `"res://grass.tres"`, is stored as-is
with no warning. Nothing reads it back, since no render component exists yet.

## Known limitations

- **Not drawn** Godot draws the batch of textured instances. The previewer draws nothing
  for this node.
