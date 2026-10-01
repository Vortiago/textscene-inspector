---
type: DirectionalLight3D
category: 3D
status: unreviewed
fixture: unit-directional-light-3d.tscn
image: unit-directional-light-3d
renders_as: a THREE.DirectionalLight
---

# DirectionalLight3D

A parallel light, like sunlight, lighting every surface from one fixed direction. The previewer emits a `THREE.DirectionalLight` aimed down the node's local -Z, whose shadow covers the viewing camera's view in one, two or four splits and fades out towards `directional_shadow_max_distance`, as in Godot.

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

The lenient parser reads `directional_shadow_mode`, the three `directional_shadow_split_*` offsets, `directional_shadow_max_distance`, `directional_shadow_pancake_size` and `directional_shadow_fade_start` through `parseOptionalInt` and `parseOptionalFloat`, which return `undefined` with no warning when absent or unparseable, so the renderer takes Godot's default: four splits at 0.1, 0.2 and 0.5, and a fade from 0.8 of the distance. It reads `directional_shadow_blend_splits` through `parseOptionalBool`, which reads an unparseable value as `false`. An out-of-range split offset or fade start reaches the renderer as written, as Godot's setter keeps it. It never reads `sky_mode`.

## Known limitations

- **Approximated** The shadow's near edge shows more contrast here, where Godot's bright sky ambient washes it out.
- **Approximated** Each shadowed DirectionalLight3D draws into a shadow atlas of its own, so in a scene with several of them a shadow is sharper than in Godot, which shares one atlas between them.
- **Approximated** A caster more than one view-slice diameter towards the light casts no shadow. Godot flattens every such caster onto the shadow map's near plane, and three.js has no equivalent.
