---
type: SpotLight3D
category: 3D
status: unreviewed
fixture: unit-spot-light-3d.tscn
image: unit-spot-light-3d
renders_as: a THREE.SpotLight
---

# SpotLight3D

Godot's cone-shaped light, emitting from a point along its local -Z axis and fading toward the cone's rim and its range. The previewer renders it as a `THREE.SpotLight` with energy scaled by PI to match Godot's brightness and the cone edge softened through `penumbra`.

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

The lenient parser falls back silently when a key is absent, and warns then falls back when it is unparseable: `spot_range` to `5.0`, `spot_angle` to `45.0`, `spot_attenuation` to `1.0`, `spot_angle_attenuation` to `1.0`.

## Known limitations

- **Approximated** Distance falloff follows three's inverse-square curve rather than Godot's, so the lit pool near the cube reads slightly brighter.
- **Approximated** `spot_angle_attenuation` maps onto three's single `penumbra` value, so the cone-edge softness curve differs.
- **Approximated** The shadow's penumbra is a little lighter and grainier than Godot's filtered edge.
- **Editor only** The wireframe cone gizmo appears only in Godot's editor. Here it is selection-gated.
