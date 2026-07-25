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

## Known limitations

- **CylinderMesh single cap** — three removes both end caps or neither, so a Godot cylinder with exactly one of `cap_top` / `cap_bottom` disabled renders with both caps.
- **ArrayMesh compressed attributes** — a surface flagged `COMPRESS_ATTRIBUTES` stores UVs as quantized uint16; the decoder reads the uncompressed layout only, so such a surface renders untextured rather than with a scrambled texture.
