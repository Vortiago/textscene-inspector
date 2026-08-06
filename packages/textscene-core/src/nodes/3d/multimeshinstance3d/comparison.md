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

None visible in this fixture.

## Linting

<!-- lint:begin MultiMeshInstance3D -->
<!-- lint:end -->

The lenient parser does not call `multimesh`'s validator at all — that path only runs
in `StrictTscnParser`. Given `multimesh = "res://grass.tres"` (a bare string instead of
a `SubResource`/`ExtResource` reference), the lenient parser stores whatever string it
read on the node's generic property bag and moves on with no substitution and no
warning; since MultiMeshInstance3D registers no render component yet, nothing ever
reads that value back to notice it is not a resource reference at all.
