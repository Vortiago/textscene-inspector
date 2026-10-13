---
type: AreaLight3D
category: 3D
status: unreviewed
group: Lighting
fixture: unit-area-light-normalize.tscn
image: unit-area-light-normalize
renders_as: a THREE.RectAreaLight shaded as Godot 4.7.2's area light
---

# AreaLight3D

Godot's rectangular area lamp, which lights the side its local -Z faces. The previewer draws Godot 4.7.2's area light: `light_energy` spread over `area_size`, faded by `area_range` and `area_attenuation`, with `light_specular` on the highlight. It shades each material in its `diffuse_mode` and `specular_mode`, and a clearcoat dims the light beneath it. With `distance_fade_enabled`, the light fades by Godot's smoothstep over the distance from the rendering camera. In volumetric fog, it scatters `light_volumetric_fog_energy` times its light into the medium. The reference image comes from Godot 4.7.2, as Godot 4.6.3 emits no light from the node.

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
| `valid-light3d-scale` (type-family match) | `light3d-non-unit-scale` | warning |
<!-- lint:end -->

The lenient parser falls back silently when a key is absent. When a key is unparseable, it warns and falls back: `area_range` to `5.0`, `area_attenuation` to `1.0`, `area_size` to `Vector2(1, 1)`, `area_normalize_energy` to `true`.

## Known limitations

- **Approximated** `shadow_enabled` casts no shadow, so a surface behind an occluder stays lit.
- **Shader missing** `area_texture` is not drawn, so the light emits its flat `light_color`.
