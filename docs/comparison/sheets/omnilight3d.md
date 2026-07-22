---
type: OmniLight3D
category: 3D
fixture: unit-omni-light-3d.tscn
image: unit-omni-light-3d
renders_as: a THREE.PointLight
---

# OmniLight3D

Godot's omnidirectional point light — it emits from a single point in every
direction with distance attenuation. The previewer renders it as a
THREE.PointLight inside the node's transform group, energy scaled by PI to match
Godot's brightness. Its wireframe-sphere gizmo is selection-gated, so it appears
in neither capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` origin | `(1.5, 2, 1.5)` | lights the cube from above the front-right, throwing its shadow to the front-left |
| `light_color` | `Color(1, 0.9, 0.75)` | warm tint on the lit ground and the cube's faces |
| `light_energy` | `2.0` | brightness of the lit pool on the plane |
| `omni_range` | `8.0` | reach of the light — the whole plane falls inside it |
| `omni_attenuation` | `1.0` | falloff exponent, carried to three's `decay` |
| `shadow_enabled` | `true` | the cube casts a shadow onto the ground |

## Divergences

The shadow's contact edge. In our render the shadow silhouette at the base of
the cube is stepped and jagged; in Godot the same edge is smooth and soft. three
renders a point light's shadow through a cube shadow map, whose resolution and
bias leave an aliased fringe, where Godot filters its omni shadow to a soft edge.
The shadow's direction, extent and the warm lit pool otherwise match — the ground
illumination agrees to within ~1/255 across the whole plane, so the omni/spot
distance-falloff divergence does not surface at this range.
