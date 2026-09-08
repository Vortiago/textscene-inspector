---
type: CSGMesh3D
category: 3D
status: unreviewed
fixture: unit-csg-mesh.tscn
image: unit-csg-mesh
renders_as: a solid built from an arbitrary Mesh resource
---

# CSGMesh3D

The CSG shape whose solid comes from a `Mesh` resource, so any mesh can take part in a boolean. The previewer builds the geometry through the same `buildPrimitiveMeshGeometry` MeshInstance3D uses, and its one `material` replaces the mesh's own, as in Godot.

## Linting

<!-- lint:begin CSGMesh3D -->
Strict parsing format-checks these `CSGMesh3D` properties, plus 1 inherited from CSGPrimitive3D, 6 inherited from CSGShape3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `material` | null, SubResource("id") or ExtResource("id") |  |
| `mesh` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-csgshape3d-own-geometry` (type-family match) | `csgmesh3d-requires-mesh` | info |
|  | `csgpolygon3d-insufficient-points` | info |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The lenient parser copies `mesh` through only when present, so an absent one leaves the node with no solid, which is Godot's empty brush and not an error. `flip_faces` warns then falls back to `false` when unparseable. Neither side rejects a non-manifold `mesh` such as PlaneMesh, since Godot excludes those only in its property hint.
