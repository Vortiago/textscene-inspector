---
type: CSGMesh3D
category: 3D
status: limitation
fixture: unit-csg-mesh.tscn
image: unit-csg-mesh
renders_as: a solid built from an arbitrary Mesh resource
---

# CSGMesh3D

The CSG shape whose solid comes from a `Mesh` resource, so any mesh can take part in a boolean. The previewer builds the solid from the triangle surfaces of an inline or `.tres` PrimitiveMesh or ArrayMesh. Each face takes the node's `material`, else its own surface's material, as in Godot.

A TextMesh with a TrueType or OpenType-CFF scene font builds its brush from its glyph outlines, inline or in a `.tres`. The brush builds once the font file and its metrics have loaded. The text draws as a solid and takes part in a boolean as any other mesh does. The golden `unit-csg-mesh-text-mesh` shows both. The gap to Godot is the glyph hinting that the TextMesh sheet lists.

## Linting

<!-- lint:begin CSGMesh3D -->
Strict parsing format-checks these `CSGMesh3D` properties, plus 1 inherited from CSGPrimitive3D, 6 inherited from CSGShape3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `material` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `mesh` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

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

The linter warns (`resource-type-excluded-by-hint`) when `mesh` holds a class its hint excludes: a `PlaneMesh`, `PointMesh`, `QuadMesh` or `RibbonTrailMesh`. Godot's editor never offers such a class, and the setter keeps it without a warning (`csg_shape.cpp:1302-1316`). A `PointMesh` adds nothing to the solid, as in Godot, whose brush builder skips every surface that is not triangles (`csg_shape.cpp:1148-1150`).

The lenient parser copies `mesh` through only when present. An absent one leaves the node with no solid, which is Godot's empty brush and not an error. `flip_faces` warns then falls back to `false` when unparseable.

A `mesh` that is an open brush adds nothing to the solid, as in Godot. A PlaneMesh, a QuadMesh, a RibbonTrailMesh and a CylinderMesh with a cap off are open. The node's own open brush also empties everything folded into it, its children included. The inspector shows Godot's empty-shape warning for such a node, for a node with no mesh, and for each child. Neither side rejects such a `mesh` when it parses, since Godot excludes those meshes only in its property hint.

## Known limitations

- **Resource gap** A TextMesh whose font has no outlines the previewer reads adds nothing to the solid, and the node's details name the type.
