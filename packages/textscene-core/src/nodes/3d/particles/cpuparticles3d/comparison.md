---
type: CPUParticles3D
category: 3D
status: unreviewed
fixture: unit-cpuparticles3d-row.tscn
image: unit-cpuparticles3d-row
renders_as: one instance of the mesh per particle, in a frozen pose
---

# CPUParticles3D

CPUParticles3D is Godot's CPU-simulated emitter. The previewer runs a port of the engine's own simulation once. It draws each particle as an instance of `mesh`, posed, scaled and coloured as Godot's buffer writes it. The particle colour reaches a material only through `vertex_color_use_as_albedo`, as in Godot.

## Linting

<!-- lint:begin CPUParticles3D -->
Strict parsing format-checks these `CPUParticles3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `amount` | integer 1-1000000 | error below, warning above |
| `angle_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `angle_max` | float |  |
| `angle_min` | float |  |
| `angular_velocity_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `angular_velocity_max` | float |  |
| `angular_velocity_min` | float |  |
| `anim_offset_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `anim_offset_max` | float 0-1 | warning |
| `anim_offset_min` | float 0-1 | warning |
| `anim_speed_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `anim_speed_max` | float |  |
| `anim_speed_min` | float |  |
| `color` | Color(r, g, b, a), or the colour string or int it converts |  |
| `color_initial_ramp` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `color_ramp` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `damping_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `damping_max` | float >= 0 | warning below |
| `damping_min` | float >= 0 | warning below |
| `direction` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `draw_order` | enum 0-2 (INDEX/LIFETIME/VIEW_DEPTH) | error |
| `emission_box_extents` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `emission_colors` | PackedColorArray(r, g, b, a, …) |  |
| `emission_normals` | PackedVector3Array(x, y, z, …) |  |
| `emission_points` | PackedVector3Array(x, y, z, …) |  |
| `emission_ring_axis` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `emission_ring_cone_angle` | float 0-90 | warning |
| `emission_ring_height` | float >= 0 | warning below |
| `emission_ring_inner_radius` | float >= 0 | warning below |
| `emission_ring_radius` | float >= 0 | warning below |
| `emission_shape` | enum 0-6 (POINT/SPHERE/SPHERE_SURFACE/BOX/POINTS/DIRECTED_POINTS/RING) | error |
| `emission_sphere_radius` | float 0.01-128 | warning |
| `emitting` | true or false |  |
| `explosiveness` | float 0-1 | warning |
| `fixed_fps` | integer 0-1000 | warning |
| `flatness` | float 0-1 | warning |
| `fract_delta` | true or false |  |
| `gravity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `hue_variation_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `hue_variation_max` | float -1-1 | warning |
| `hue_variation_min` | float -1-1 | warning |
| `initial_velocity_max` | float >= 0 | warning below |
| `initial_velocity_min` | float >= 0 | warning below |
| `lifetime` | float >= 0.01 | error at or below 0, warning below 0.01 |
| `lifetime_randomness` | float 0-1 | warning |
| `linear_accel_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `linear_accel_max` | float |  |
| `linear_accel_min` | float |  |
| `local_coords` | true or false |  |
| `mesh` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `one_shot` | true or false |  |
| `orbit_velocity_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `orbit_velocity_max` | float |  |
| `orbit_velocity_min` | float |  |
| `particle_flag_align_y` | true or false |  |
| `particle_flag_disable_z` | true or false |  |
| `particle_flag_rotate_y` | true or false |  |
| `preprocess` | float >= 0 | warning below |
| `radial_accel_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `radial_accel_max` | float |  |
| `radial_accel_min` | float |  |
| `randomness` | float 0-1 | warning |
| `scale_amount_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `scale_amount_max` | float >= 0 | warning below |
| `scale_amount_min` | float >= 0 | warning below |
| `scale_curve_x` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `scale_curve_y` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `scale_curve_z` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `seed` | integer 0-4294967295 | warning |
| `speed_scale` | float 0-64 | warning |
| `split_scale` | true or false |  |
| `spread` | float 0-180 | warning |
| `tangential_accel_curve` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `tangential_accel_max` | float |  |
| `tangential_accel_min` | float |  |
| `use_fixed_seed` | true or false |  |
| `visibility_aabb` | AABB(x, y, z, w, h, d) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
| `valid-cpuparticles3d-properties` | `cpuparticles3d-requires-mesh` | warning |
|  | `cpuparticles3d-param-min-above-max` | warning |
<!-- lint:end -->

Where strict rejects a value, the lenient parser substitutes Godot's constructor default. A `lifetime` at or below `0` reads as `1.0`, and an `amount` below `1` as `8`. A malformed `spread` reads as `45.0`, a malformed `gravity` as `Vector3(0, -9.8, 0)` and an out-of-range `emission_shape` as `POINT`. An unreadable packed emission array reads as empty.

## Particle draw

The frozen pose sits at Godot's own `preprocess` moment, else at one `lifetime`, or half of it for a `one_shot`. `draw_order` sorts the instances by index, by age or along the camera's view axis. The billboard modes of the material face each particle to the camera, and `PARTICLES` mode reads the particle's rotation and plays the `particles_anim_*` flipbook. `material_override` and `material_overlay` draw on every instance.

The scene cull measures an emitter by `visibility_aabb`, else by the box of its live particles. The selection box and the editor framing leave the particles out, as Godot's `get_aabb` does.

## Gizmo

An emitter draws these in Godot's editor. Godot draws the box and the axes for every emitter, faint while unselected, and the emission shape and the fill only for the selected one. Godot's source is `cpu_particles_3d_gizmo_plugin.cpp:62-107` and `particles_3d_emission_shape_gizmo_plugin.cpp:82-339`.

- The 12 edges of `visibility_aabb`, in the editor's particle-box colour. Without an authored box the edges have zero length at the origin.
- Three unit axis lines from the centre of the box.
- The lines of the emission shape: three circles for a sphere, the 12 edges of a box, and the tapered cylinder for a ring. A point shape and the point-cloud shapes draw no lines.
- A fill of the box with an opacity of 0.016.

Godot's billboard icon marks the origin of every emitter, faint while it is not selected, and the previewer draws it too.

## Known limitations

- **Needs runtime** The emitter runs in Godot and freezes here, at the moment named above.
- **Approximated** An emitter without `use_fixed_seed` takes a fixed constant seed, so its particles sit in plausible places where Godot randomises them on every run.
- **Approximated** With more than one point in `emission_points`, Godot picks each particle's point from its process-wide RNG, which no scene saves, so the previewer picks other points of the same set.
- **Approximated** An `amount` above `1000000`, the most Godot's own editor allows, draws `1000000` particles, where Godot draws them all.
- **Editor only** The box and axes draw at 0.3 alpha while unselected (ADR-0056) when the Gizmos toggle is on, which a capture keeps off.
