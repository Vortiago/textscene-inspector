---
type: MultiMeshInstance2D
category: 2D
status: unimplemented
fixture: unit-multi-mesh-instance-2d.tscn
# image: unit-multi-mesh-instance-2d
renders_as: nothing yet — Godot draws a batch of textured mesh instances, the previewer does not
---

# MultiMeshInstance2D

MultiMeshInstance2D instances a [MultiMesh] resource in 2D, batch-drawing many copies of
one mesh in a single draw call and optionally texturing them via `texture` for the
default [CanvasItemMaterial] (doc/classes/MultiMeshInstance2D.xml) — this DOES draw in
Godot, but the previewer only parses and validates this node so far and does not draw it
yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `multimesh` | `SubResource("MultiMesh_1")` | the MultiMesh this instance would batch-render (not yet drawn) |
| `texture` | `ExtResource("1_marker")` | the Texture2D the default CanvasItemMaterial would sample (not yet drawn) |

## Divergences

None visible in this fixture.

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

Given `multimesh = "res://grass.tres"` (a bare string instead of a `SubResource`/
`ExtResource` reference), the lenient parser stores whatever string it read on the
node's generic property bag and moves on with no substitution and no warning; since
MultiMeshInstance2D registers no render component yet, nothing ever reads that value
back to notice it is not a resource reference at all. The same holds for `texture`.
