---
type: DirectionalLight3D
category: 3D
fixture: unit-directional-light-3d.tscn
image: unit-directional-light-3d
renders_as: a THREE.DirectionalLight
---

# DirectionalLight3D

A parallel light source (sunlight) lighting every surface from one fixed
direction. The previewer emits a `THREE.DirectionalLight` aimed down the node's
local -Z; it warms the lit faces of the box and the ground, and with
`shadow_enabled` casts a shadow map.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` (basis) | angled down toward -X/-Z | direction the parallel light travels; which box faces read lit |
| `light_color` | `Color(1, 0.95, 0.85, 1)` | warm cream tint on the lit box faces |
| `light_energy` | `1.2` | brightness of the lit faces |
| `shadow_enabled` | `true` | the box casts a ground shadow |

## Divergences

Ground-shadow contrast. Ours renders a soft shadow darkening at the base of the
box, spilling onto the ground to its left; the Godot frame reads essentially
clean there. Both carry the same warm directional light — colour, energy, and
lit-face tint agree — and the ~30° sun projects its shadow the same way in both,
mostly behind the box and occluded from this camera. The difference is only in
the near edge: three.js draws it with visible contrast where Godot's is washed
out by the bright sky-ambient fill. No PARITY-LIMITATIONS entry covers
directional shadows.
