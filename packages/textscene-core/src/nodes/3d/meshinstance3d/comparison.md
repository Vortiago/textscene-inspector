---
type: MeshInstance3D
category: 3D
status: limitation
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

## Known limitations

- **Approximated** A transparent material renders darker than Godot's on a brightly lit
  face. An opaque one agrees.
- **Approximated** three removes both cylinder caps or neither, so a `CylinderMesh` with exactly one of `cap_top` and `cap_bottom` disabled renders with both.
