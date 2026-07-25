---
type: CSGMesh3D
category: 3D
fixture: unit-csg-mesh.tscn
image: unit-csg-mesh
renders_as: a solid built from an arbitrary Mesh resource
---

# CSGMesh3D

The CSG shape whose solid comes from a `Mesh` resource rather than from a
built-in primitive, so any mesh can take part in a boolean. The previewer builds
its geometry through the same `buildPrimitiveMeshGeometry` that MeshInstance3D
uses, so a BoxMesh renders identically whichever node names it. The boolean
`operation` IS evaluated (ADR-0026).

Godot's `material` on this node REPLACES the mesh's own surface material rather
than layering per-surface overrides the way MeshInstance3D does, and the
previewer follows that: none of MeshInstance3D's `surface_material_override/N`
fan-out applies here.

This node has **zero occurrences in the vendored corpus**, so unlike every other
CSG fixture this one is authored from the class reference rather than copied from
a real scene.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mesh` (BoxFromMesh) | `BoxMesh` `size` `Vector3(1.5, 1, 1.5)` | the flat slab at left |
| `mesh` (CapsuleFromMesh) | `CapsuleMesh` `radius` `0.4`, `height` `1.6` | the upright capsule at right |
| `material` | albedo `Color(0.3, 0.6, 0.8)` | the blue surface both carry, replacing each mesh's own |
| `mesh` (NoMesh) | absent | Godot builds an empty brush, so this node draws nothing — and must not throw or show a missing-resource placeholder |

PlaneMesh and QuadMesh are deliberately absent from the fixture: Godot's own
property hint excludes them because they are not manifold and so cannot take part
in a boolean.

## Divergences

None visible in this fixture. Measured at 0.030% against Godot 4.6.3 with
`pnpm ref:diff unit-csg-mesh.tscn`.
