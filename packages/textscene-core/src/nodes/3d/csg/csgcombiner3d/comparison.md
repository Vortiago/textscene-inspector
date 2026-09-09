---
type: CSGCombiner3D
category: 3D
status: unreviewed
renders_as: a grouping node whose children fold into one solid
---

# CSGCombiner3D

The only CSG node with no shape of its own. It exists so a set of CSG children folds into one solid, which then combines into its parent by its own `operation`. The previewer evaluates the boolean at the CSG root (ADR-0027), so only the root draws a mesh and clicking the result selects the root, as in Godot's editor.

## Grouping and visibility
<!-- compare: image=unit-csg-combiner status=done fixture=unit-csg-combiner.tscn -->

A combiner under a StaticBody3D holding two CSGBox3D children, plus a hidden combiner whose sphere never draws. Both images show the slab, the raised step and no sphere.

## Union, subtraction, intersection
<!-- compare: image=unit-csg-boolean-ops status=done fixture=unit-csg-boolean-ops.tscn -->

Three identical box-plus-sphere pairs differing only in the sphere's `operation`. Left to right: union bulges out of the box, subtraction bites a cavity into it, intersection leaves only the lens where the two overlap.

## One surface per material
<!-- compare: image=unit-csg-multi-material status=done fixture=unit-csg-multi-material.tscn -->

Three contributions with three materials come out as three surfaces on one mesh, as Godot interns each material per root. The subtracted cavity carries the subtracting node's red, not the shell's green.

## Transparency through a boolean result
<!-- compare: image=unit-csg-transparency status=limitation fixture=unit-csg-transparency.tscn -->

A subtraction whose result carries a transparent material, so the hole is seen through glass.

- **Approximated** The glass panel reads lighter and bluer in Godot. The shape, the hole and the opaque half match, and the difference lies in the shared material pipeline's transparency handling.

## Linting

<!-- lint:begin CSGCombiner3D -->
Strict parsing format-checks the inherited set (6 inherited from CSGShape3D, 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node); `CSGCombiner3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

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

The combiner's only validated property is `operation`. The lenient parser reads it with `parseOptionalInt` and warns neither when absent nor when unparseable, and its `visible` flag is handled by the shared Node3D validator listed above.
