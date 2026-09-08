---
type: MeshInstance2D
category: 2D
status: unimplemented
fixture: unit-mesh-instance-2d.tscn
# image: unit-mesh-instance-2d
renders_as: nothing yet — Godot draws a textured mesh, the previewer does not
---

# MeshInstance2D

MeshInstance2D draws a [Mesh] in 2D, optionally textured with `texture` for the default
[CanvasItemMaterial] (doc/classes/MeshInstance2D.xml) — this DOES draw in Godot, but the
previewer only parses and validates this node so far and does not draw it yet, so it
renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mesh` | `SubResource("QuadMesh_1")` | the Mesh this instance would draw (not yet drawn) |
| `texture` | `ExtResource("1_marker")` | the Texture2D the default CanvasItemMaterial would sample (not yet drawn) |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin MeshInstance2D -->
Strict parsing format-checks these `MeshInstance2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `mesh` | null, SubResource("id") or ExtResource("id") |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

Given `mesh = "res://quad.tres"` (a bare string instead of a `SubResource`/`ExtResource`
reference), the lenient parser stores whatever string it read on the node's generic
property bag and moves on with no substitution and no warning; since MeshInstance2D
registers no render component yet, nothing ever reads that value back to notice it is
not a resource reference at all. The same holds for a malformed `texture`.
