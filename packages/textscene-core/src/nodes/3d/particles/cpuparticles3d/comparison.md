---
type: CPUParticles3D
category: 3D
status: unimplemented
fixture: unit-cpu-particles-3d.tscn
# image: unit-cpu-particles-3d
renders_as: nothing yet, not implemented
---

# CPUParticles3D

Godot draws a live particle cloud from this node's CPU-simulated particles; the previewer parses and validates it but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

The fixture sets a representative value for every property, grouped below the way
`cpu_particles_3d.cpp`'s own `ADD_GROUP` calls group them in the inspector.

| Group | Values | Effect |
| --- | --- | --- |
| top-level | `emitting=true`, `amount=32` | none: emission on/off and particle count; not drawn |
| `Time` | `lifetime=2.0`, `one_shot=false`, `preprocess=0.0` | none: per-particle playback timing; not drawn |
| top-level (cont.) | `speed_scale=1.0`, `explosiveness=0.0`, `randomness=0.2`, `use_fixed_seed=true`, `seed=42`, `lifetime_randomness=0.1`, `fixed_fps=30`, `fract_delta=true` | none: emission cadence and RNG seeding; not drawn |
| `Drawing` | `visibility_aabb=AABB(-2,-2,-2,4,4,4)`, `local_coords=false`, `draw_order=1`, `mesh=SphereMesh` | none: the assigned `SphereMesh` is the per-particle geometry, not yet drawn |
| `Emission Shape` | `emission_shape=6` (RING), plus `emission_sphere_radius`, `emission_box_extents`, `emission_points`, `emission_normals`, `emission_colors`, `emission_ring_axis/height/radius/inner_radius/cone_angle` | none: where new particles spawn; not drawn |
| `Particle Flags` | `particle_flag_align_y=true`, `particle_flag_rotate_y=false`, `particle_flag_disable_z=false` | none: per-particle orientation/axis behaviour; not drawn |
| `Direction` | `direction=Vector3(0,1,0)`, `spread=30.0`, `flatness=0.0` | none: initial velocity cone; not drawn |
| `Gravity` | `gravity=Vector3(0,-9.8,0)` | none: constant per-particle acceleration; not drawn |
| `Initial Velocity` | `initial_velocity_min=2.0`, `initial_velocity_max=4.0` | none: launch speed range; not drawn |
| `Angular Velocity` | `angular_velocity_min=-90.0`, `angular_velocity_max=90.0`, `angular_velocity_curve=Curve` | none: rotation speed over lifetime; not drawn |
| `Orbit Velocity` | `orbit_velocity_min=0.0`, `orbit_velocity_max=0.5`, `orbit_velocity_curve=Curve` | none: only used with `particle_flag_disable_z`; not drawn |
| `Linear Accel` | `linear_accel_min=0.0`, `linear_accel_max=1.0`, `linear_accel_curve=Curve` | none: acceleration along velocity; not drawn |
| `Radial Accel` | `radial_accel_min=-1.0`, `radial_accel_max=1.0`, `radial_accel_curve=Curve` | none: acceleration toward/away from origin; not drawn |
| `Tangential Accel` | `tangential_accel_min=-1.0`, `tangential_accel_max=1.0`, `tangential_accel_curve=Curve` | none: acceleration perpendicular to velocity; not drawn |
| `Damping` | `damping_min=0.0`, `damping_max=1.0`, `damping_curve=Curve` | none: velocity decay over lifetime; not drawn |
| `Angle` | `angle_min=-45.0`, `angle_max=45.0`, `angle_curve=Curve` | none: per-particle mesh rotation; not drawn |
| `Scale` | `scale_amount_min=0.8`, `scale_amount_max=1.2`, `scale_amount_curve=Curve`, `split_scale=true`, `scale_curve_x/y/z=Curve` | none: per-particle size over lifetime; not drawn |
| `Color` | `color=Color(1,1,1,1)`, `color_ramp=Gradient`, `color_initial_ramp=Gradient` | none: multiplies the (absent) mesh's vertex colors; not drawn |
| `Hue Variation` | `hue_variation_min=-0.1`, `hue_variation_max=0.1`, `hue_variation_curve=Curve` | none: per-particle hue shift; not drawn |
| `Animation` | `anim_speed_min=0.5`, `anim_speed_max=1.5`, `anim_speed_curve=Curve`, `anim_offset_min=0.0`, `anim_offset_max=1.0`, `anim_offset_curve=Curve` | none: needs a billboard material to show; not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin CPUParticles3D -->
Strict parsing format-checks these `CPUParticles3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `amount` | integer 1-1000000 | error |
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
| `damping_max` | float >= 0 | warning |
| `damping_min` | float >= 0 | warning |
| `direction` | Vector3(x, y, z) |  |
| `draw_order` | enum 0-2 (INDEX/LIFETIME/VIEW_DEPTH) | error |
| `emission_box_extents` | Vector3(x, y, z) |  |
| `emission_colors` | PackedColorArray(r, g, b, a, …) |  |
| `emission_normals` | PackedVector3Array(x, y, z, …) |  |
| `emission_points` | PackedVector3Array(x, y, z, …) |  |
| `emission_ring_axis` | Vector3(x, y, z) |  |
| `emission_ring_cone_angle` | float 0-90 | warning |
| `emission_ring_height` | float >= 0 | warning |
| `emission_ring_inner_radius` | float >= 0 | warning |
| `emission_ring_radius` | float >= 0 | warning |
| `emission_shape` | enum 0-6 (POINT/SPHERE/SPHERE_SURFACE/BOX/POINTS/DIRECTED_POINTS/RING) | error |
| `emission_sphere_radius` | float 0.01-128 | warning |
| `emitting` | true or false |  |
| `explosiveness` | float 0-1 | warning |
| `fixed_fps` | integer 0-1000 | warning |
| `flatness` | float 0-1 | warning |
| `fract_delta` | true or false |  |
| `gravity` | Vector3(x, y, z) |  |
| `hue_variation_curve` | null, SubResource("id") or ExtResource("id") |  |
| `hue_variation_max` | float -1-1 | warning |
| `hue_variation_min` | float -1-1 | warning |
| `initial_velocity_max` | float >= 0 | warning |
| `initial_velocity_min` | float >= 0 | warning |
| `lifetime` | float > 0 | error |
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
| `preprocess` | float >= 0 | warning |
| `radial_accel_curve` | null, SubResource("id") or ExtResource("id") |  |
| `radial_accel_max` | float |  |
| `radial_accel_min` | float |  |
| `randomness` | float 0-1 | warning |
| `scale_amount_curve` | null, SubResource("id") or ExtResource("id") |  |
| `scale_amount_max` | float >= 0 | warning |
| `scale_amount_min` | float >= 0 | warning |
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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
| `valid-cpuparticles3d-mesh` | `cpuparticles3d-requires-mesh` | warning |
|  | `valid-cpuparticles3d-resources` | error |
<!-- lint:end -->

The lenient parser reuses `parseNode3D` (index.ts), which reads only `transform` and
`visible`, so none of the 77 `linterParser.ts` keys above is ever read: a malformed
value like `spread = 400.0` or a dangling `mesh` reference is silently dropped rather
than substituted or warned on, consistent with the node rendering as a transform-only
fallback. The one semantic rule this slice adds (`linter.ts`) ports
`get_configuration_warnings`'s "no mesh assigned" case, which the fixture avoids by
assigning a `SphereMesh`.
