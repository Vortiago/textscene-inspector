---
type: MeshInstance3D
category: 3D
fixture: unit-torus-mesh.tscn
image: unit-torus-mesh
renders_as: a THREE.Mesh
---

# MeshInstance3D

MeshInstance3D draws its `mesh` resource as a THREE.Mesh. This fixture feeds it a
`TorusMesh` with an orange metallic `StandardMaterial3D` override, so the previewer
builds a `torusGeometry` and shades it. The donut lies flat, hole facing up, with a
glossy highlight, and the scene's two Label3D captions sit above and below it.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mesh` | `TorusMesh` sub-resource | the donut geometry that is drawn |
| `inner_radius` | `0.5` | radius of the hole |
| `outer_radius` | `1.5` | radius to the outer edge |
| `rings` / `ring_segments` | `32` / `16` | tessellation — both frames read as a smooth ring |
| `surface_material_override/0` | `StandardMaterial3D` | replaces the surface material |
| `albedo_color` | `Color(0.9, 0.5, 0.2, 1)` | the orange body |
| `metallic` / `roughness` | `0.8` / `0.2` | glossy metal with the tight specular streak both frames share |

## Divergences

The torus now agrees on orientation: both frames lay it flat with the hole opening
upward, matching outer/inner radii, tessellation, orange albedo, and the paired
specular highlights. Both also render the two Label3D captions — the pale-yellow
"TorusMesh Test" title above and the white description line below.

The captions differ only in typeface: Godot draws them in its default font, while ours
uses the previewer's bundled font, so the glyph shapes and stroke weight of the same
text read slightly differently. The grey-sky-over-brown-ground preview environment
otherwise matches.

## Linting

<!-- lint:begin MeshInstance3D -->
Strict parsing format-checks these `MeshInstance3D` properties, plus 17 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `mesh` | SubResource("id") or ExtResource("id") |
| `skeleton` | NodePath("path/to/node") |
| `skin` | SubResource("id") or ExtResource("id") |
| `surface_material_override/*` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-meshinstance3d-resources` | `valid-meshinstance3d-resources` | error |
|  | `valid-meshinstance3d-surface-index` | warning |
|  | `valid-meshinstance3d-visibility-range` | error |
|  | `valid-meshinstance3d-skeleton` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The enum and range properties (`cast_shadow`, `gi_mode`, `gi_lightmap_scale`,
`visibility_range_fade_mode`, the four `visibility_range_*` floats, `layers`) go through
`parseOptionalInt`/`parseOptionalFloat`: an unparseable value is dropped silently, with no
warning, and any value that parses but sits outside the valid range (say `cast_shadow=99`)
is kept as-is, since these readers do no range or enum membership check. An absent or
out-of-range `cast_shadow` behaves the same either way, since the component treats
anything other than `0`/`2`/`3` as `1` (cast ON), Godot's own default. `mesh`,
`material_override`, `material_overlay`, `skeleton`, `skin`, and each
`surface_material_override/<n>` are assigned straight from the raw string whenever
present; the lenient parser never checks that they resolve to a real resource or node.

## Known limitations

- **CylinderMesh single cap** — three removes both end caps or neither, so a Godot cylinder with exactly one of `cap_top` / `cap_bottom` disabled renders with both caps.
