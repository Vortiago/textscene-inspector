---
type: SpotLight3D
category: 3D
fixture: unit-spot-light-3d.tscn
image: unit-spot-light-3d
renders_as: a THREE.SpotLight
---

# SpotLight3D

Godot's cone-shaped light — it emits from a point along its local -Z axis and
fades toward the cone's rim and its range. The previewer renders it as a
THREE.SpotLight inside the node's transform group, energy scaled by PI to match
Godot's brightness and the cone edge softened through `penumbra`. Its
wireframe-cone gizmo is selection-gated, so it appears in neither capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` origin | `(0, 3, 0)`, aimed straight down | hangs the light above the cube, so the lit circle and the shadow center on it |
| `light_color` | `Color(0.9, 0.95, 1, 1)` | faint cool-white tint on the lit ground |
| `light_energy` | `3.0` | brightness of the lit pool on the plane |
| `spot_range` | `8.0` | reach of the cone — the floor sits well inside it |
| `spot_angle` | `30.0` | half-angle of the cone → diameter of the lit circle |
| `shadow_enabled` | `true` | the cube casts a shadow straight down onto the ground |

## Divergences

Two, both slight. The lit pool close to the cube reads a touch brighter in our
render — about 4-5/255 across the illuminated ring — while the far floor outside
the cone and the pool's own outer edge match Godot to within ~1/255. That
near-field lift is the distance-falloff curve: three's inverse-square-with-
windowing runs hotter than Godot's `pow(1 - d/range)` through the middle of the
range.

The shadow's near edge. Its dark core matches Godot, but the penumbra sits a few
/255 lighter and its edge is softer and slightly grainier than Godot's cleanly
filtered one — a shadow-map resolution/bias artifact, not the cone.
