---
type: GPUParticles2D
category: 2D
status: unimplemented
fixture: unit-gpu-particles-2d.tscn
# image: unit-gpu-particles-2d
renders_as: nothing yet, Godot draws a particle cloud, the previewer does not
---

# GPUParticles2D

GPUParticles2D emits a GPU-simulated particle cloud. The previewer parses and validates
it but does not draw it, so it renders as a transform-only fallback and its children
still show.

## Linting

<!-- lint:begin GPUParticles2D -->
Strict parsing format-checks these `GPUParticles2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `amount` | integer 1-1000000 | error below, warning above |
| `amount_ratio` | float 0-1 | warning |
| `collision_base_size` | float >= 0 | warning below |
| `draw_order` | enum 0-2 (INDEX/LIFETIME/REVERSE_LIFETIME) | warning |
| `emitting` | true or false |  |
| `explosiveness` | float 0-1 | warning |
| `fixed_fps` | integer 0-1000 | warning |
| `fract_delta` | true or false |  |
| `interp_to_end` | float 0-1 | error |
| `interpolate` | true or false |  |
| `lifetime` | float >= 0.01 | error at or below 0, warning below 0.01 |
| `local_coords` | true or false |  |
| `one_shot` | true or false |  |
| `preprocess` | float >= 0 | warning below |
| `process_material` | null, SubResource("id") or ExtResource("id") |  |
| `randomness` | float 0-1 | warning |
| `seed` | integer 0-4294967295 | warning |
| `speed_scale` | float 0-64 | warning |
| `sub_emitter` | NodePath("path/to/node") |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |
| `trail_enabled` | true or false |  |
| `trail_lifetime` | float >= 0.01 | error below 0.00999, warning below 0.01 |
| `trail_section_subdivisions` | integer 1-1024 | error |
| `trail_sections` | integer 2-128 | error |
| `use_fixed_seed` | true or false |  |
| `visibility_rect` | Rect2(x, y, w, h), or the Rect2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-gpuparticles2d-process-material` | `gpuparticles2d-missing-process-material` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D` and reads none of the emitter keys, so a value
strict rejects is dropped rather than substituted. `draw_order` only warns out of range,
since its setter takes any int and only the inspector hint bounds it.

## Known limitations

- **Not drawn** Godot draws the particle cloud. The previewer draws nothing for this
  node.
