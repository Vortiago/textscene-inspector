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
builds a `torusGeometry` and shades it. The donut and its glossy highlight come
through; the two frames disagree only on which way the ring faces.

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

- **The torus faces the wrong way.** Godot's donut lies flat, hole opening upward —
  a foreshortened ring seen from slightly above. Ours stands upright and tilted, hole
  turned toward the camera, so it reads as a larger, rounder ring on a diagonal. Cause:
  Godot's `TorusMesh` revolves around Y (lies in the XZ plane); three's `torusGeometry`
  revolves around Z (lies in the XY plane), and the previewer passes it through
  unrotated, so under the shared camera it stands where Godot lies down. No
  PARITY-LIMITATIONS entry covers this.

The fixture's two `Label3D` captions ("TorusMesh Test", the description line) show in
Godot but not in ours — in-viewport Label3D text is toggle-gated off by default
(ADR-0008), covered by the Label3D sheet, not a MeshInstance3D gap. Material, colour,
and the grey-sky-over-brown-ground preview environment otherwise agree.
