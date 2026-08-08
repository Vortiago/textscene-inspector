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
out by the bright sky-ambient fill.

## Linting

<!-- lint:begin DirectionalLight3D -->
Strict parsing format-checks these `DirectionalLight3D` properties, plus 15 inherited from Light3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `directional_shadow_blend_splits` | true or false |
| `directional_shadow_fade_start` | float 0-1 |
| `directional_shadow_max_distance` | float |
| `directional_shadow_mode` | enum 0-2 (ORTHOGONAL/PARALLEL_2_SPLITS/PARALLEL_4_SPLITS) |
| `directional_shadow_pancake_size` | float >= 0 |
| `directional_shadow_split_1` | float 0-1 |
| `directional_shadow_split_2` | float 0-1 |
| `directional_shadow_split_3` | float 0-1 |
| `sky_mode` | enum 0-2 (LIGHT_AND_SKY/LIGHT_ONLY/SKY_ONLY) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-directionallight3d-properties` | `directionallight3d-negative-energy` | warning |
|  | `directionallight3d-negative-shadow-distance` | warning |
|  | `directionallight3d-unused-splits` | warning |
| `valid-light3d-scale` (type-family match) | `light3d-non-unit-scale` | warning |
<!-- lint:end -->

The lenient parser reads only two of these nine properties: `directional_shadow_mode`
and `directional_shadow_max_distance`, both via `parseOptionalInt`/`parseOptionalFloat`,
which return `undefined` with no warning when absent or unparseable. The other seven
(the three shadow splits, `directional_shadow_fade_start`, `directional_shadow_pancake_size`,
`directional_shadow_blend_splits`, `sky_mode`) are never read by the lenient parser at
all, so a value strict rejects there (an out-of-order shadow split, say) never reaches
the renderer either way.
