---
type: Decal
category: 3D
status: unreviewed
fixture: unit-decal.tscn
image: unit-decal
renders_as: a texture projected onto the surfaces its box intersects
---

# Decal

Godot's texture projector: it casts `texture_albedo` down the node's local -Y axis onto the surfaces inside its `size` box, blended onto the lit surface. The previewer bakes the same projection onto each mesh the box overlaps and shades it with the scene's lights, honouring `cull_mask` and the three fades.

## Linting

<!-- lint:begin Decal -->
Strict parsing format-checks these `Decal` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `albedo_mix` | float 0-1 | warning |
| `cull_mask` | 32-bit layer mask (layers 1-32) |  |
| `distance_fade_begin` | float >= 0 | warning below |
| `distance_fade_enabled` | true or false |  |
| `distance_fade_length` | float >= 0 | warning below |
| `emission_energy` | float >= 0 | warning below |
| `lower_fade` | float >= 0 | error below |
| `modulate` | Color(r, g, b, a) |  |
| `normal_fade` | float 0-0.999 | warning |
| `size` | Vector3(x, y, z), each float >= 0.001 | error below |
| `sorting_offset` | float |  |
| `texture_albedo` | null, SubResource("id") or ExtResource("id") |  |
| `texture_emission` | null, SubResource("id") or ExtResource("id") |  |
| `texture_normal` | null, SubResource("id") or ExtResource("id") |  |
| `texture_orm` | null, SubResource("id") or ExtResource("id") |  |
| `upper_fade` | float >= 0 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-decal-resources` | `decal-requires-texture` | warning |
|  | `decal-normal-orm-without-albedo` | warning |
|  | `decal-empty-cull-mask` | warning |
<!-- lint:end -->

`size` falls back to Godot's default `Vector3(2, 2, 2)` with a warning when malformed. `albedo_mix`, `emission_energy`, `normal_fade`, `upper_fade`, `lower_fade` and `cull_mask` fall back the same way to `1`, `1`, `0`, `0.3`, `0.3` and `1048575`. The two fade exponents are also clamped at zero, as Godot's setters clamp them. `modulate` falls back silently to opaque white, and the four `texture_*` references are copied through unvalidated.

## Known limitations

- **Approximated** The projection reads bolder than Godot's at a partial `albedo_mix`, since exact blending needs a custom projector shader.
- **Approximated** The depth and normal fades are baked per vertex, so a large decal on a low-poly tilted or curved receiver bands where Godot's is smooth.
- **Approximated** `texture_normal`, `texture_orm`, `texture_emission` and `emission_energy` are parsed but not applied, so the projection carries albedo alone.
