---
type: DirectionalLight3D
category: 3D
status: unreviewed
fixture: unit-directional-light-3d.tscn
image: unit-directional-light-3d
renders_as: a THREE.DirectionalLight
---

# DirectionalLight3D

A sun-like light that lights every surface from one direction, down the node's local -Z. The previewer draws a `THREE.DirectionalLight` with Godot's shadow, fitted to the camera in one, two or four splits. Each shadow takes its share of one atlas and fades out at `directional_shadow_max_distance`.

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

The lenient parser reads the shadow mode, the three split offsets, the max distance, the pancake size, the fade start, `directional_shadow_blend_splits` and `sky_mode`. An absent, unparseable or non-finite value takes Godot's default. The defaults are four splits at 0.1, 0.2 and 0.5, no blending, and a fade from 0.8 of the distance. An out-of-range split offset or fade start reaches the renderer as written, as Godot's setter keeps it.

The shadow's soft edge reaches `shadow_blur` times two atlas texels, the radius of Godot's default Soft Low filter.

`sky_mode` decides what the light reaches, as in Godot. A Sky Only light draws only its sun in the sky, and casts no shadow. A Light Only light lights surfaces and draws no sun in the sky.

Godot draws the first eight visible directional lights in the scene and stops. A light past the eighth neither lights nor casts, here as in Godot. So at most eight directional lights cast a shadow.

## Known limitations

- **Approximated** A shadow's near edge has more contrast than in Godot, where the bright sky ambient washes it out.
- **Approximated** A caster more than one view diameter towards the sun casts no shadow, where Godot still draws it.
- **Approximated** The soft edge takes five filter taps where Godot's Soft Low takes four, so its dither pattern differs. Its mean matches.
- **Approximated** The editor camera's clip planes follow the framing, so the shadow's splits and fade can end nearer or further than in Godot's editor.
