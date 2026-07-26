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

## Linting

<!-- lint:begin SpotLight3D -->
Strict parsing format-checks these `SpotLight3D` properties, plus 15 inherited from Light3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `spot_angle` |
| `spot_angle_attenuation` |
| `spot_attenuation` |
| `spot_range` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-spotlight3d-properties` | `spotlight3d-extreme-energy` | warning |
|  | `spotlight3d-large-range` | warning |
|  | `spotlight3d-small-range` | warning |
|  | `spotlight3d-extreme-attenuation` | warning |
|  | `spotlight3d-extreme-angle-attenuation` | warning |
|  | `spotlight3d-small-angle` | warning |
<!-- lint:end -->

Strict rejects a non-positive `spot_range`, a negative `spot_attenuation` or
`spot_angle_attenuation`, or a `spot_angle` outside 0-90 degrees as errors. The lenient
parser instead falls back silently when a property is absent, or warns and falls back
when present but unparseable: `spot_range` to `5.0`, `spot_angle` to `45.0`,
`spot_attenuation` to `1.0`, `spot_angle_attenuation` to `1.0`.

## Known limitations

- **Distance falloff** — as for OmniLight3D, Godot's `pow(1 - d/range, attenuation)` and three's inverse-square differ through the middle of the range; matched at the source.
- **spot_angle_attenuation → penumbra** — Godot's cone-edge softness curve has no exact three analogue (`SpotLight.penumbra` is a single 0..1). Approximated as `penumbra = 1/(spot_angle_attenuation + 1)`, landing the default at a moderately soft 0.5.
