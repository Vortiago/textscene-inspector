---
type: AreaLight3D
category: 3D
status: unreviewed
group: Lighting
fixture: unit-area-light3d.tscn
image: unit-area-light3d
renders_as: a THREE.RectAreaLight
---

# AreaLight3D

Godot's rectangular area lamp. The previewer renders it as a `THREE.RectAreaLight` sized from `area_size`, emitting `light_color` at `light_energy`. Godot 4.6.3 parses the node but emits no light from it, so the reference image is lit by the editor preview sun alone.

## Linting

<!-- lint:begin AreaLight3D -->
Strict parsing format-checks these `AreaLight3D` properties, plus 27 inherited from Light3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `area_normalize_energy` | true or false |  |
| `area_range` | float |  |
| `area_size` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-light3d-scale` (type-family match) | `light3d-non-unit-scale` | warning |
<!-- lint:end -->

The lenient parser falls back silently when a key is absent, and warns then falls back when it is unparseable: `area_range` to `5.0`, `area_size` to `Vector2(1, 1)`, `area_normalize_energy` to `true`.

## Known limitations

- **Approximated** `THREE.RectAreaLight` has no shadow or range control, so `shadow_enabled` and `area_range` are parsed but never drawn.
