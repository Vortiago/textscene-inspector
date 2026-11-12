---
type: GPUParticles3D
category: 3D
status: unreviewed
fixture: unit-gpuparticles3d.tscn
image: unit-gpuparticles3d
renders_as: each draw pass at every particle, in a frozen pose
---

# GPUParticles3D

GPUParticles3D is Godot's GPU-simulated emitter. The previewer steps a port of the engine's particle shader once, in the engine's frame loop. It draws each draw pass at every live particle. The start colour is in linear light, as the material's `source_color` makes it.

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

The lenient parser reads the GeometryInstance3D base, `visibility_aabb`, the `process_material` reference, the emitter keys and the draw passes. `visibility_aabb` is the box the scene cull measures the emitter by, and the gizmo draws it. Where strict rejects a value, the lenient parser takes the node constructor's default. An `amount` below `1` reads as `8`, and a `lifetime` at or below `0` as `1.0`. The simulation keys come from a ParticleProcessMaterial that the parser reads from its resource, with the material constructor's defaults, for example `direction` is `(1, 0, 0)`.

Strict parsing also checks all 96 properties of a ParticleProcessMaterial `[sub_resource]` or `.tres`, against `particle_process_material.cpp`. A setter assigns every value bare except `emission_shape`, so a value outside a property's range warns, and an `emission_shape` past the enum errors. The `particleprocessmaterial-param-min-above-max` rule warns on a `_min` above its `_max`, where one of the two loads as the other.

## Particle draw

The frozen pose sits at Godot's own `preprocess` moment, else at one `lifetime`, or half of it for a `one_shot`. The step is `1 / fixed_fps`, or `1 / 30` for `fixed_fps = 0`, and the last step overshoots, as the engine's loop does. `speed_scale` never moves the pose, because the engine's settle runs at a speed scale of 1 (`particles_storage.cpp:1555-1563`). `draw_passes` draws each pass up to four, with its own materials, and `material_override` and `material_overlay` draw on every instance. A particle past its lifetime, or above `amount_ratio`, draws nothing, and neither does an emitter that is not emitting.

With `local_coords` false the particles sit in world space, so gravity acts along the world axes. With `local_coords` true they follow the node.

The scene cull measures an emitter by `visibility_aabb`. The selection box and the editor framing leave the particles out, as Godot's `get_aabb` does.

## Gizmo

A selected emitter draws two sets of lines. Godot draws both only while the node is selected. Godot's source is `gpu_particles_3d_gizmo_plugin.cpp:61-84` and `particles_3d_emission_shape_gizmo_plugin.cpp:82-339`.

- The 12 edges of `visibility_aabb`, in the editor's particle-box colour. An unauthored box is Godot's default, an AABB from (-4, -4, -4) of size 8.
- The lines of the emission shape of the `process_material`. A sphere gives three circles, a box gives 12 edges, and a ring gives a tapered cylinder. A point shape and the point-cloud shapes draw no lines.
- The shape lines move by the material's `emission_shape_offset` and grow by its `emission_shape_scale`.

Godot reads the shape only from a ParticleProcessMaterial. A ShaderMaterial or an empty `process_material` draws the box and no shape lines. A ring with a radius of 0 draws the lines that stay finite, as Godot does.

Godot's billboard icon marks the origin of every emitter, faint while it is not selected, and the previewer draws it too.

## Known limitations

- **Needs runtime** The emitter runs in Godot and freezes here, at the moment named above.
- **Approximated** An emitter without `use_fixed_seed` takes a fixed constant seed, so its particles sit in plausible places where Godot randomises them on every run.
- **Not drawn** An emitter with an emission shape of `POINTS` or `DIRECTED_POINTS` draws no particle, because the emission texture is not read.
- **Missing** The process material's curves, ramps, hue variation, angle, orbit, damping, radial and directional velocity, turbulence and flags are not read.
- **Missing** `draw_order`, `transform_align`, trails and sub-emitters are not read, so the particles draw in index order with their own basis.
- **Missing** Attractors and collision nodes do not move the particles.
- **Shader missing** A ShaderMaterial as the `process_material` is not translated, so the emitter draws no particle.
- **Approximated** An `amount` times settle steps above 2,000,000 draws every nth particle, each where Godot puts it, so the main thread stays free.
- **Approximated** A `preprocess` above 600 seconds, the top of its range, settles for 600 seconds.
- **Approximated** An `amount` above `1000000`, the most Godot's own editor allows, draws `1000000` particles, where Godot draws them all.
