---
type: SpotLight3D
category: 3D
status: done
fixture: unit-spot-light-3d.tscn
image: unit-spot-light-3d
renders_as: a THREE.SpotLight
---

# SpotLight3D

Godot's cone-shaped light, emitting from a point along its local -Z axis and fading toward the cone's rim and its range. The previewer renders it as a `THREE.SpotLight` with energy scaled by PI to match Godot's brightness. A shader patch gives it Godot's distance falloff and Godot's fade from the axis to the cone's rim, at the power `spot_angle_attenuation` sets. A `spot_range` under 0.001 cuts the light off at 0.001, as Godot's light buffer does, so a range of 0 lights nothing. Its highlight scales by twice `light_specular`, as Godot's does. `light_size` widens its lit side and its highlight by Godot's size term, so a large light near a surface reaches past the surface's horizon. In volumetric fog, it scatters `light_volumetric_fog_energy` times its light into the medium, under its shadow.

## Linting

<!-- lint:begin SpotLight3D -->

Strict parsing format-checks these `SpotLight3D` properties, plus 27 inherited from Light3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property                 | Accepts     | Out of range  |
| ------------------------ | ----------- | ------------- |
| `spot_angle`             | float 0-180 | warning       |
| `spot_angle_attenuation` | float       |               |
| `spot_attenuation`       | float       |               |
| `spot_range`             | float >= 0  | warning below |

| Rule                                          | Reports                                | Severity |
| --------------------------------------------- | -------------------------------------- | -------- |
| `binary-resource-reference` (all nodes)       | `binary-resource-reference`            | info     |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility`              | error    |
| `valid-spotlight3d-properties`                | `spotlight3d-shadow-angle-too-wide`    | warning  |
|                                               | `spotlight3d-projector-without-shadow` | warning  |
| `valid-light3d-scale` (type-family match)     | `light3d-non-unit-scale`               | warning  |

<!-- lint:end -->

The linter warns (`resource-type-excluded-by-hint`) when `light_projector` holds a class its hint excludes, such as an `AtlasTexture`. Godot's editor never offers such a class, and the setter keeps it with a debug warning (`light_3d.cpp:204-213`).

The lenient parser falls back silently when a key is absent. When a key is unparseable, it warns and falls back: `spot_range` to `5.0`, `spot_angle` to `45.0`, `spot_attenuation` to `1.0`, `spot_angle_attenuation` to `1.0`.

Godot's positional shadow atlas gives the light one slot for the camera, and the shadow takes it. A light that covers less of the view gets a smaller slot and a coarser, softer shadow. When other lights fill the larger slots, a light earlier in the scene tree takes a smaller slot, as in Godot. A sub-viewport gives its lights slots in its own atlas. Every omni and spot shadow lies in one atlas texture, so many shadowed lights fit beside a material with many textures. The soft edge takes the four taps of Godot's default Soft Low filter, with the same dither as Godot. The filter spans `shadow_blur` times two texels of the atlas. With a `light_size` and a `shadow_blur`, the shadow searches for blockers, as Godot's does. Its penumbra widens with the light's size and with the distance from the caster. `shadow_bias` and `shadow_normal_bias` move the receiver as Godot's lookup does, so the shadow edge sits where Godot puts it.

`light_negative` makes the light subtract with a negative three intensity, as in Godot. `shadow_opacity` mixes the shadow towards unshadowed through three's `shadow.intensity`. With `distance_fade_enabled`, the light and its shadow fade by Godot's smoothstep over the distance from the rendering camera. Each drops out past its fade end.

## Known limitations

- **Editor only** The wireframe cone gizmo appears only in Godot's editor, and here it draws for the selected node when the Gizmos toggle is on.
