---
type: SpotLight3D
category: 3D
status: unreviewed
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

## Linting

<!-- lint:begin SpotLight3D -->
Strict parsing format-checks these `SpotLight3D` properties, plus 27 inherited from Light3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `spot_angle` | float 0-180 | warning |
| `spot_angle_attenuation` | float |  |
| `spot_attenuation` | float |  |
| `spot_range` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-spotlight3d-properties` | `spotlight3d-shadow-angle-too-wide` | warning |
|  | `spotlight3d-projector-without-shadow` | warning |
| `valid-light3d-scale` (type-family match) | `light3d-non-unit-scale` | warning |
<!-- lint:end -->

None of the four spot properties is enforced by Godot (`Light3D::set_param` guards the
param index, not the value), so strict reports no errors for them: a negative
`spot_range` and a `spot_angle` outside 0-180 degrees warn, and the two attenuations
have no stated range to fall outside. The lenient
parser falls back silently when a property is absent, or warns and falls back
when present but unparseable: `spot_range` to `5.0`, `spot_angle` to `45.0`,
`spot_attenuation` to `1.0`, `spot_angle_attenuation` to `1.0`.

## Known limitations

- **Distance falloff** — as for OmniLight3D, Godot's `pow(1 - d/range, attenuation)` and three's inverse-square differ through the middle of the range; matched at the source.
- **spot_angle_attenuation → penumbra** — Godot's cone-edge softness curve has no exact three analogue (`SpotLight.penumbra` is a single 0..1). Approximated as `penumbra = 1/(spot_angle_attenuation + 1)`, landing the default at a moderately soft 0.5.
