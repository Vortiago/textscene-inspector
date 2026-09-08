---
type: CPUParticles2D
category: 2D
status: limitation
fixture: unit-cpuparticles2d.tscn
image: unit-cpuparticles2d
renders_as: one merged quad mesh holding a frozen particle pose
---

# CPUParticles2D

CPUParticles2D is Godot's CPU-simulated emitter. The previewer runs a port of the
engine's own simulation once, PCG32 generator included, and draws the result as one
merged quad mesh holding a frozen pose.

## Emission shapes
<!-- compare: image=unit-cpuparticles2d-emission-shapes status=done fixture=unit-cpuparticles2d-emission-shapes.tscn -->

Point, Sphere, Sphere Surface and Rectangle side by side. With `use_fixed_seed` and
`preprocess` set, every particle lands within half a pixel of Godot's.

## Curves
<!-- compare: image=unit-cpuparticles2d-curves status=done fixture=unit-cpuparticles2d-curves.tscn -->

The `min`, `max` and `curve` parameter mechanism, on `scale_amount` and `angle`.

## Colour ramps
<!-- compare: image=unit-cpuparticles2d-color-ramp status=done fixture=unit-cpuparticles2d-color-ramp.tscn -->

`color_ramp` fades each particle by age, and `color_initial_ramp` picks one colour at
birth.

## local_coords
<!-- compare: image=unit-cpuparticles2d-local-coords status=done fixture=unit-cpuparticles2d-local-coords.tscn -->

A scaled emitter's particles do not scale with it by default, in Godot as here.

## emitting = false
<!-- compare: image=unit-cpuparticles2d-not-emitting status=done fixture=unit-cpuparticles2d-not-emitting.tscn -->

Godot draws nothing for an emitter that is neither active nor emitting, and neither does
the previewer. An empty frame here is the correct frame.

## Linting

<!-- lint:begin CPUParticles2D -->
Strict parsing format-checks these `CPUParticles2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

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
| `direction` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `draw_order` | enum 0-1 (INDEX/LIFETIME) | warning |
| `emission_colors` | PackedColorArray(r, g, b, a, …) |  |
| `emission_normals` | PackedVector2Array(x, y, …) |  |
| `emission_points` | PackedVector2Array(x, y, …) |  |
| `emission_rect_extents` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `emission_ring_inner_radius` | float |  |
| `emission_ring_radius` | float |  |
| `emission_shape` | enum 0-6 (POINT/SPHERE/SPHERE_SURFACE/RECTANGLE/POINTS/DIRECTED_POINTS/RING) | error |
| `emission_sphere_radius` | float 0.01-128 | warning |
| `emitting` | true or false |  |
| `explosiveness` | float 0-1 | warning |
| `fixed_fps` | integer 0-1000 | warning |
| `fract_delta` | true or false |  |
| `gravity` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
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
| `one_shot` | true or false |  |
| `orbit_velocity_curve` | null, SubResource("id") or ExtResource("id") |  |
| `orbit_velocity_max` | float |  |
| `orbit_velocity_min` | float |  |
| `particle_flag_align_y` | true or false |  |
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
| `seed` | integer 0-4294967295 | warning |
| `speed_scale` | float 0-64 | warning |
| `split_scale` | true or false |  |
| `spread` | float 0-180 | warning |
| `tangential_accel_curve` | null, SubResource("id") or ExtResource("id") |  |
| `tangential_accel_max` | float |  |
| `tangential_accel_min` | float |  |
| `texture` | null, SubResource("id") or ExtResource("id") |  |
| `use_fixed_seed` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-cpuparticles2d-preview` | `cpuparticles2d-nondeterministic-emission-shape` | info |
|  | `cpuparticles2d-fract-delta-ignored` | info |
<!-- lint:end -->

Where strict rejects a value, the lenient parser substitutes Godot's constructor
default. `lifetime` reads as `1.0`, `spread` as `45.0`, a malformed `gravity` as
`Vector2(0, 980)` and an out-of-range `emission_shape` as `POINT`. An `amount` below `1`
clamps to `1`. `draw_order` is not range-checked, since Godot's setter accepts any int
and reads everything but `1` as `Index`.

## Known limitations

- **Needs runtime** The emitter runs in Godot and freezes here. With `preprocess` set
  the frozen moment is Godot's own. Without it the previewer picks one `lifetime`, or
  half of one for a `one_shot` burst.
- **Approximated** An emitter without `use_fixed_seed` takes a fixed constant seed. Its
  particles sit in plausible places rather than the engine's, which Godot randomises on
  every run.
- **Approximated** `speed_scale` does not move a preprocessed pose, since Godot forces
  it to 1 while preprocessing. It applies only to the substituted window.
- **Approximated** `split_scale`, `scale_curve_x` and `scale_curve_y` are not read, so a
  quad stretched on one axis draws square.
- **Approximated** `emission_shape` POINTS, DIRECTED_POINTS and RING sample Godot's
  process-wide RNG, so they emit from the origin here and raise a warning.
- **Approximated** `fract_delta` is ignored, so a particle can sit up to one frame
  behind Godot's. A scene that sets it explicitly is warned.
