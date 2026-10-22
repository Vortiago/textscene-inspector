---
type: GPUParticles3D
category: 3D
status: unimplemented
fixture: unit-gpuparticles3d.tscn
image: unit-gpuparticles3d
renders_as: nothing yet, Godot draws a particle cloud, the previewer does not
---

# GPUParticles3D

A GPU-simulated particle emitter. The previewer runs no simulation, so the emitter contributes no geometry and only its transform and `visible` flag take effect.

## Linting

<!-- lint:begin GPUParticles3D -->
Strict parsing format-checks these `GPUParticles3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `amount` | integer 1-1000000 | error below, warning above |
| `amount_ratio` | float 0-1 | warning |
| `collision_base_size` | float >= 0 | warning below |
| `draw_order` | enum 0-3 (INDEX/LIFETIME/REVERSE_LIFETIME/VIEW_DEPTH) | warning |
| `draw_pass_1` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `draw_pass_2` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `draw_pass_3` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `draw_pass_4` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `draw_passes` | integer 1-4 | error below, warning above |
| `draw_skin` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
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
| `process_material` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `randomness` | float 0-1 | warning |
| `seed` | integer 0-4294967295 | warning |
| `speed_scale` | float 0-64 | warning |
| `sub_emitter` | NodePath("path/to/node") |  |
| `trail_enabled` | true or false |  |
| `trail_lifetime` | float >= 0.01 | error below 0.00999, warning below 0.01 |
| `transform_align` | enum 0-4 (DISABLED/Z_BILLBOARD/Y_TO_VELOCITY/Z_BILLBOARD_Y_TO_VELOCITY/LOCAL_BILLBOARD) | warning |
| `use_fixed_seed` | true or false |  |
| `visibility_aabb` | AABB(x, y, z, w, h, d) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-gpuparticles3d-resources` | `gpuparticles3d-missing-process-material` | warning |
|  | `gpuparticles3d-no-draw-pass-mesh` | warning |
|  | `valid-gpuparticles3d-sub-emitter` | info |
|  | `gpuparticles3d-sub-emitter-self` | info |
|  | `gpuparticles3d-sub-emitter-wrong-type` | info |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

The lenient parser reads the GeometryInstance3D base, `visibility_aabb` and the `process_material` reference. `visibility_aabb` is the box the scene cull measures the emitter by, and the gizmo draws it. The emission shape keys come from a ParticleProcessMaterial that the parser reads from its resource. The parser never reads `amount`, `lifetime` or `draw_pass_1`, so an invalid or missing value has no lenient-side effect, and only strict reports it.

## Gizmo

A selected emitter draws two sets of lines. Godot draws both only while the node is selected. Godot's source is `gpu_particles_3d_gizmo_plugin.cpp:61-84` and `particles_3d_emission_shape_gizmo_plugin.cpp:82-339`.

- The 12 edges of `visibility_aabb`, in the editor's particle-box colour. An unauthored box is Godot's default, an AABB from (-4, -4, -4) of size 8.
- The lines of the emission shape of the `process_material`. A sphere gives three circles, a box gives 12 edges, and a ring gives a tapered cylinder. A point shape and the point-cloud shapes draw no lines.
- The shape lines move by the material's `emission_shape_offset` and grow by its `emission_shape_scale`.

Godot reads the shape only from a ParticleProcessMaterial. A ShaderMaterial or an empty `process_material` draws the box and no shape lines. A ring with a radius of 0 draws the lines that stay finite, as Godot does.

The previewer draws no billboard icon.

## Known limitations

- **Not drawn** Godot draws the burst of orange emissive spheres mid-flight, but here only the sky and ground appear.
