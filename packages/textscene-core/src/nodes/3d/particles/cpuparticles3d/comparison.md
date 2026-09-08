---
type: CPUParticles3D
category: 3D
status: unimplemented
fixture: unit-cpu-particles-3d.tscn
# image: unit-cpu-particles-3d
renders_as: nothing yet, not implemented
---

# CPUParticles3D

A CPU-simulated particle emitter that draws its `mesh` once per live particle. The previewer does not draw the cloud yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin CPUParticles3D -->
Strict parsing format-checks these `CPUParticles3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `amount` | integer 1-1000000 | error below, warning above |
| `angle_curve` | null, SubResource("id") or ExtResource("id") |  |
| `angle_max` | float |  |
| `angle_min` | float |  |
| `angular_velocity_curve` | null, SubResource("id") or ExtResource("id") |  |
| `angular_velocity_max` | float |  |
| `angular_velocity_min` | float |  |
| `anim_offset_curve` | null, SubResource("id") or ExtResource("id") |  |
| `anim_offset_max` | float 0-1 | warning |
| `anim_offset_min` | float 0-1 | warning |
| `anim_speed_curve` | null, SubResource("id") or ExtResource("id") |  |
| `anim_speed_max` | float |  |
| `anim_speed_min` | float |  |
| `color` | Color(r, g, b, a) |  |
| `color_initial_ramp` | null, SubResource("id") or ExtResource("id") |  |
| `color_ramp` | null, SubResource("id") or ExtResource("id") |  |
| `damping_curve` | null, SubResource("id") or ExtResource("id") |  |
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
| `hue_variation_curve` | null, SubResource("id") or ExtResource("id") |  |
| `hue_variation_max` | float -1-1 | warning |
| `hue_variation_min` | float -1-1 | warning |
| `initial_velocity_max` | float >= 0 | warning below |
| `initial_velocity_min` | float >= 0 | warning below |
| `lifetime` | float >= 0.01 | error at or below 0, warning below 0.01 |
| `lifetime_randomness` | float 0-1 | warning |
| `linear_accel_curve` | null, SubResource("id") or ExtResource("id") |  |
| `linear_accel_max` | float |  |
| `linear_accel_min` | float |  |
| `local_coords` | true or false |  |
| `mesh` | null, SubResource("id") or ExtResource("id") |  |
| `one_shot` | true or false |  |
| `orbit_velocity_curve` | null, SubResource("id") or ExtResource("id") |  |
| `orbit_velocity_max` | float |  |
| `orbit_velocity_min` | float |  |
| `particle_flag_align_y` | true or false |  |
| `particle_flag_disable_z` | true or false |  |
| `particle_flag_rotate_y` | true or false |  |
| `preprocess` | float >= 0 | warning below |
| `radial_accel_curve` | null, SubResource("id") or ExtResource("id") |  |
| `radial_accel_max` | float |  |
| `radial_accel_min` | float |  |
| `randomness` | float 0-1 | warning |
| `scale_amount_curve` | null, SubResource("id") or ExtResource("id") |  |
| `scale_amount_max` | float >= 0 | warning below |
| `scale_amount_min` | float >= 0 | warning below |
| `scale_curve_x` | null, SubResource("id") or ExtResource("id") |  |
| `scale_curve_y` | null, SubResource("id") or ExtResource("id") |  |
| `scale_curve_z` | null, SubResource("id") or ExtResource("id") |  |
| `seed` | integer 0-4294967295 | warning |
| `speed_scale` | float 0-64 | warning |
| `split_scale` | true or false |  |
| `spread` | float 0-180 | warning |
| `tangential_accel_curve` | null, SubResource("id") or ExtResource("id") |  |
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
| `valid-cpuparticles3d-mesh` | `cpuparticles3d-requires-mesh` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`, so none of the 77 keys strict validates is ever read. A `spread = 400.0` or a dangling `mesh` reference is dropped silently, and `linter.ts` ports the "no mesh assigned" configuration warning.

## Known limitations

- **Not drawn** Godot draws the live particle cloud. Here nothing appears.
