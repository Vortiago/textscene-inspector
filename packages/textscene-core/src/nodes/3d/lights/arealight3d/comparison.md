---
type: AreaLight3D
category: 3D
group: Lighting
renders_as: a THREE.RectAreaLight shaded as Godot 4.7.2's area light
---

# AreaLight3D

Godot's rectangular area lamp, which lights the side its local -Z faces. The previewer draws Godot 4.7.2's area light: `light_energy` spread over `area_size`, faded by `area_range` and `area_attenuation`, with `light_specular` on the highlight. `area_texture` colours the light. It shades each material in its `diffuse_mode` and `specular_mode`, and a clearcoat dims the light beneath it. With `distance_fade_enabled`, the light fades by Godot's smoothstep over the distance from the rendering camera. In volumetric fog, it scatters `light_volumetric_fog_energy` times its light into the medium, under its shadow. The reference images come from Godot 4.7.2, as Godot 4.6.3 emits no light from the node.

## Energy over the rectangle
<!-- compare: image=unit-area-light-normalize status=unreviewed fixture=unit-area-light-normalize.tscn -->

A 1×1 panel and a 4×0.05 strip at the same energy, over matte plates. `area_normalize_energy` divides each light's colour by its area, so both plates receive the same total light.

## Texture
<!-- compare: image=unit-area-light-texture status=unreviewed fixture=unit-area-light-texture.tscn -->

The 1×1 panel of the energy scene with a red-to-blue gradient as its `area_texture`. The plate below the panel turns purple: at that distance the light reads a blurred mip of the texture, which mixes the two colours. A surface closer to the panel reads a sharper mip and shows the red and the blue apart.

An `AtlasTexture` as the `area_texture` colours the light with its whole sheet, not its region, as Godot does: the light reads the texture by its RID, which is the sheet's.

## Shadow
<!-- compare: image=unit-area-light3d status=done fixture=unit-area-light3d.tscn -->

A 2×1 light over a box on the ground, with `shadow_enabled` on and `area_range` 6. The box casts a soft shadow on the ground that widens away from the box, at the default `light_size` of 0.5. `shadow_opacity`, `shadow_bias`, `shadow_normal_bias`, `shadow_blur` and the distance fade apply as in Godot.

## Linting

<!-- lint:begin AreaLight3D -->
Strict parsing format-checks these `AreaLight3D` properties, plus 27 inherited from Light3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `area_attenuation` | float |  |
| `area_normalize_energy` | true or false |  |
| `area_range` | float >= 0 | warning below |
| `area_size` | Vector2(x, y), each >= 0 |  |
| `area_texture` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-arealight3d-properties` | `arealight3d-projector-unsupported` | warning |
| `valid-light3d-scale` (type-family match) | `light3d-non-unit-scale` | warning |
<!-- lint:end -->

The lenient parser falls back silently when a key is absent. When a key is unparseable, it warns and falls back: `area_range` to `5.0`, `area_attenuation` to `1.0`, `area_size` to `Vector2(1, 1)`, `area_normalize_energy` to `true`, `light_size` to `0.5`.
