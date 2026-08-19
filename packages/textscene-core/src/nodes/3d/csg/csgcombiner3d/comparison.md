---
type: CSGCombiner3D
category: 3D
renders_as: a grouping node whose children fold into one solid
---

# CSGCombiner3D

The only CSG node with no shape of its own: Godot's `_build_brush()` returns an
empty brush. It exists so a set of CSG children folds into a single solid, which
then combines into ITS parent by its own `operation`.

That makes it the natural home for the boolean machinery itself, so the sections
below cover what a CSG root does rather than what this one node draws. The rules,
all of them Godot's:

- A **CSG root** is a CSG node whose DIRECT parent is not one. Only the root
  produces a drawn mesh; every CSG descendant becomes a transform-only group that
  contributes its solid and its `operation`.
- Contributions fold bottom-up in child order.
- Invisible children are skipped by the boolean, but not by the BOUNDS: `_get_brush()`
  skips one before writing its `node_aabb`, so the editor still merges a POINT at its
  origin. A root builds whatever its OWN visibility — `update_shape()` is gated on
  `is_root_shape()` alone — so an invisible root keeps its full box.
- A root's own `operation` is inert — it has nothing to combine into.

Because only the root has a mesh, clicking the result selects the root, exactly
as in Godot's editor. Tree-selecting a contributor still gives it a selection box:
each one keeps an invisible bounds proxy, sized to its own brush — or, for an
invisible contributor, to the point Godot has for it.

## Grouping and visibility
<!-- compare: image=unit-csg-combiner status=done fixture=unit-csg-combiner.tscn -->

The fixture takes its shape from the vendored witness in
`ragdoll_physics.tscn`: a CSGCombiner3D under a StaticBody3D holding CSGBox3D
children.

| Property | Value | Effect |
| --- | --- | --- |
| `size` (Ground) | `Vector3(4, 0.25, 4)` | the wide grey-green slab |
| `size` (SmallLedge) | `Vector3(1.5, 0.5, 0.5)` | the tan step raised on its near edge |
| `visible` (HiddenGroup) | `false` | hides that combiner's whole CSG subtree — the sphere under it never draws |

`visible` is the behaviour the slice buys outright: an unregistered
CSGCombiner3D falls through to the generic node fallback, which does not apply
`visible`, so a hidden combiner's children would keep drawing.

Measured at 0.051% against Godot 4.6.3.

## Union, subtraction, intersection
<!-- compare: image=unit-csg-boolean-ops status=done fixture=unit-csg-boolean-ops.tscn -->

Three identical box-plus-sphere pairs differing only in the sphere's
`operation`. Left to right: union bulges out of the box, subtraction bites a
cavity into it, intersection leaves only the lens where the two overlap.

| Property | Value | Effect |
| --- | --- | --- |
| `operation` (Union/Tool) | default `0` UNION | the orange dome merged into the blue box |
| `operation` (Subtraction/Tool) | `2` SUBTRACTION | the scooped cavity, its interior showing the box's own material |
| `operation` (Intersection/Tool) | `1` INTERSECTION | only the overlapping lens survives |

Measured at 0.064% against Godot 4.6.3. The residual is a faint stipple along the
cut seam where the boolean leaves coplanar triangles; Godot's own output has the
same seam in a slightly different place.

## One surface per material
<!-- compare: image=unit-csg-multi-material status=done fixture=unit-csg-multi-material.tscn -->

Godot interns each contribution's material into a per-root table and emits one
surface per distinct material. The previewer reproduces that rather than
flattening to a single material: this root has three contributions with three
materials and comes out as three surfaces on one mesh.

| Property | Value | Effect |
| --- | --- | --- |
| `material` (Shell) | green | the outer box faces |
| `material` (Cut), `operation = 2` | red | the subtracted cavity, which carries the SUBTRACTING node's material, not the shell's |
| `material` (Boss) | yellow | the small cylinder unioned onto the top face |

This is the fixture that catches a group / `materialIndex` remap bug: any
mis-mapping shows immediately as a surface in the wrong colour.

Measured at 0.064% against Godot 4.6.3.

## Transparency through a boolean result
<!-- compare: image=unit-csg-transparency status=limitation fixture=unit-csg-transparency.tscn -->

A subtraction whose result carries a transparent material, so the hole is seen
through glass.

**Divergence.** Godot's glass panel reads lighter and bluer than ours; the
difference is confined to the blue channel where a transparent surface sits over
the dark background. Measured at 1.067%, the only CSG fixture outside the 0.1%
band. The shape, the hole and the opaque half all match — this is the general
material pipeline's transparency handling, not the boolean, and it is tracked
separately.

## Linting

<!-- lint:begin CSGCombiner3D -->
Strict parsing format-checks these `CSGCombiner3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `operation` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

The combiner has no shape of its own, so its only validated property is `operation`,
which strict rejects outside 0 to 2. The lenient parser reads it with `parseOptionalInt`
and warns neither when absent nor when unparseable. Nothing else is checked because
nothing else affects what a combiner does: it contributes no solid, and its `visible`
flag is handled by the shared Node3D validator listed above.
