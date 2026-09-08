---
type: MultiMeshInstance3D
category: 3D
status: unimplemented
fixture: unit-multi-mesh-instance-3d.tscn
# image: unit-multi-mesh-instance-3d
renders_as: nothing yet — Godot draws a batch of mesh instances, the previewer does not
---

# MultiMeshInstance3D

MultiMeshInstance3D instances a [MultiMesh] resource, batch-drawing many copies of one
mesh in a single draw call (doc/classes/MultiMeshInstance3D.xml) — the classic use case
is grass or forest instancing. Godot draws every instance from the `multimesh`
resource, but the previewer only parses and validates this node so far and does not
draw it yet, so it renders as an invisible transform-only fallback and its children
still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `multimesh` | `SubResource("MultiMesh_1")` | the MultiMesh resource this instance would batch-render (not yet drawn) |
| `cast_shadow` | `2` (Double-Sided) | how the (not yet drawn) batch would cast shadows |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

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

The lenient parser does not call `multimesh`'s validator at all — that path only runs
in `StrictTscnParser`. Given `multimesh = "res://grass.tres"` (a bare string instead of
a `SubResource`/`ExtResource` reference), the lenient parser stores whatever string it
read on the node's generic property bag and moves on with no substitution and no
warning; since MultiMeshInstance3D registers no render component yet, nothing ever
reads that value back to notice it is not a resource reference at all.
