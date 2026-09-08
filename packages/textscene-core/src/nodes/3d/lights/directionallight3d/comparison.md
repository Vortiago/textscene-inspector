---
type: DirectionalLight3D
category: 3D
status: unreviewed
fixture: unit-directional-light-3d.tscn
image: unit-directional-light-3d
renders_as: a THREE.DirectionalLight
---

# DirectionalLight3D

A parallel light, like sunlight, lighting every surface from one fixed direction. The previewer emits a `THREE.DirectionalLight` aimed down the node's local -Z and casts a shadow map when `shadow_enabled` is set.

## Linting

<!-- lint:begin DirectionalLight3D -->
Strict parsing format-checks these `DirectionalLight3D` properties, plus 27 inherited from Light3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `directional_shadow_blend_splits` | true or false |  |
| `directional_shadow_fade_start` | float 0-1 | warning |
| `directional_shadow_max_distance` | float >= 0 | warning below |
| `directional_shadow_mode` | enum 0-2 (ORTHOGONAL/PARALLEL_2_SPLITS/PARALLEL_4_SPLITS) | warning |
| `directional_shadow_pancake_size` | float >= 0 | warning below |
| `directional_shadow_split_1` | float 0-1 | warning |
| `directional_shadow_split_2` | float 0-1 | warning |
| `directional_shadow_split_3` | float 0-1 | warning |
| `sky_mode` | enum 0-2 (LIGHT_AND_SKY/LIGHT_ONLY/SKY_ONLY) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-directionallight3d-properties` | `directionallight3d-unused-splits` | info |
| `valid-light3d-scale` (type-family match) | `light3d-non-unit-scale` | warning |
<!-- lint:end -->

The lenient parser reads only `directional_shadow_mode` and `directional_shadow_max_distance`, through `parseOptionalInt` and `parseOptionalFloat`, which return `undefined` with no warning when absent or unparseable. The other seven keys are never read, so an out-of-order shadow split strict rejects never reaches the renderer.

## Known limitations

- **Approximated** The shadow's near edge shows more contrast here, where Godot's bright sky ambient washes it out.
