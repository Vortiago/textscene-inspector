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

## Linting

<!-- lint:begin OmniLight3D -->
Strict parsing format-checks these `OmniLight3D` properties, plus 15 inherited from Light3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `omni_attenuation` |
| `omni_range` |
| `omni_shadow_mode` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-omnilight3d-properties` | `omnilight3d-extreme-energy` | warning |
|  | `omnilight3d-large-range` | warning |
|  | `omnilight3d-small-range` | warning |
|  | `omnilight3d-extreme-attenuation` | warning |
<!-- lint:end -->

Strict rejects a non-positive `omni_range`, a negative `omni_attenuation`, or an
`omni_shadow_mode` outside 0-1 as errors. The lenient parser falls back silently when
`omni_range`/`omni_attenuation` are absent, or warns and falls back (to `5.0` and `1.0`
respectively) when present but unparseable; `omni_shadow_mode` instead goes through
`parseOptionalInt`, so an absent or invalid value quietly becomes `undefined` with no
warning at all.

## Known limitations

- **Distance falloff** — Godot attenuates by `pow(1 - d/range, attenuation)`, reaching zero at `range`; three uses physical inverse-square with a windowing term. The energy scale is matched at the source so the near field agrees, but the mid-falloff curve shape differs.
