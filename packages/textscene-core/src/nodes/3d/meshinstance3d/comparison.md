---
type: MeshInstance3D
category: 3D
status: unreviewed
fixture: unit-torus-mesh.tscn
image: unit-torus-mesh
renders_as: a THREE.Mesh
---

# MeshInstance3D

Draws its `mesh` resource as a `THREE.Mesh`, with each `surface_material_override/N` replacing that surface's material. The fixture's orange metallic torus lies flat with the hole facing up in both images.

## Linting

<!-- lint:begin MeshInstance3D -->
Strict parsing format-checks these `MeshInstance3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `blend_shapes/*` | float -1-1 | warning |
| `mesh` | null, SubResource("id") or ExtResource("id") |  |
| `skeleton` | NodePath("path/to/node") |  |
| `skin` | null, SubResource("id") or ExtResource("id") |  |
| `surface_material_override/*` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The enum and range keys (`cast_shadow`, `gi_mode`, `layers`, the `visibility_range_*` floats) go through `parseOptionalInt` and `parseOptionalFloat`. An unparseable value is dropped silently, and an out-of-range `cast_shadow = 99` is kept as is. The component treats any `cast_shadow` other than `0`, `2` or `3` as `1`, Godot's default. `mesh`, `material_override`, `skeleton`, `skin` and each surface override are assigned from the raw string with no resolution check.

## Divergences

| What | Fixture | Godot 4.6.3 | Ours |
| --- | --- | --- | --- |
| A TRANSPARENT material's bright lit face | `unit-meshinstance3d-material-overlay.tscn` @ 640,350 | `rgb(212, 57, 54)` | `rgb(162, 60, 55)` |
| The same face, dim side | same @ 600,500 | `rgb(93, 33, 27)` | `rgb(88, 28, 21)` |
| An OPAQUE face, as the control | same @ 340,260 | `rgb(62, 227, 94)` | `rgb(69, 226, 99)` |

Measured with the red material as an ordinary `surface_material_override/0`, so
`material_overlay` is not involved: an opaque surface agrees within ~7/255 while
a transparent one's bright face is 50/255 darker here, and its dim face nearly
agrees. That shape points at the tonemap/HDR end rather than at the blend
factor. It reaches the overlay only because the overlay's own material is
transparent.

These numbers cannot be checked by hand — they are post-tonemap sRGB bytes, so
decomposing a src-over blend from them is invalid arithmetic. An expected value
has to come from Godot's own blend and tonemap source.

## Known limitations

- **Approximated** three removes both cylinder caps or neither, so a `CylinderMesh` with exactly one of `cap_top` and `cap_bottom` disabled renders with both.
