---
type: CPUParticles2D
category: 2D
fixture: unit-cpuparticles2d.tscn
image: unit-cpuparticles2d
renders_as: one merged quad mesh holding a frozen particle pose
---

# CPUParticles2D

Godot's CPU-simulated 2D particle emitter. The previewer runs the emitter's own
simulation once and draws the result as a **frozen pose**: every live particle
becomes a textured quad, merged into a single mesh so the blend order is the
`draw_order` order. There is no clock — the pose is a pure function of the
scene file, and re-opening the same file draws the same pixels.

The simulation is a port of `scene/2d/cpu_particles_2d.cpp`, including Godot's
PCG32 generator, so on a scene that pins `use_fixed_seed` and `preprocess` the
particles land where the engine puts them rather than merely looking similar.
Measured on `unit-cpuparticles2d-emission-shapes.tscn`: every particle in our
frame sits within 0.41 px of the one real Godot 4.6.3 draws.

A `CanvasItemMaterial` with `particles_animation` makes the emitter's texture a
flipbook — the isometric candle's flame is an 11-frame strip — and each particle
draws one cell of it, chosen by the animation value the simulation carries.
Without that, an emitter renders its whole sheet per particle.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `amount` | `48` | the number of particles in the plume |
| `texture` | `pong-ball.png` | the 8×8 quad each particle draws |
| `lifetime` | `1.5` | how long a particle lives, and the emitter's cycle |
| `preprocess` | `1.5` | one full cycle simulated before the frame is shown, so the plume is at its steady state instead of empty |
| `use_fixed_seed` / `seed` | `true` / `4242` | pins the random stream, so the pose is reproducible |
| `fixed_fps` | `30` | the simulation step, `1/30 s` |
| `local_coords` | `true` | particles live in the emitter's own space |
| `emission_shape` | `1` (Sphere) | births scattered inside a disc |
| `emission_sphere_radius` | `16.0` | the radius of that disc |
| `direction` / `spread` | `(0, -1)` / `20.0` | a narrow upward cone |
| `gravity` | `(0, -60)` | a gentle further lift, so the plume keeps rising |
| `initial_velocity_min/max` | `90` / `150` | the spread of speeds that stretches the plume |
| `scale_amount_min/max` | `1.5` / `4.0` | particle size, randomised per particle |
| `color_ramp` | Gradient | yellow → orange → transparent over each particle's life |

Companion fixtures, one behaviour each:

| Fixture | Behaviour |
| --- | --- |
| `unit-cpuparticles2d-not-emitting.tscn` | `emitting = false` draws nothing at all, while the node still positions its child |
| `unit-cpuparticles2d-emission-shapes.tscn` | Point, Sphere, Sphere Surface and Rectangle side by side |
| `unit-cpuparticles2d-curves.tscn` | the `min/max/curve` parameter mechanism, on `scale_amount` and `angle` |
| `unit-cpuparticles2d-color-ramp.tscn` | `color_ramp` (by age) against `color_initial_ramp` (once at birth) |
| `unit-cpuparticles2d-local-coords.tscn` | why a scaled emitter's particles do NOT scale with it by default |
| `unit-cpuparticles2d-unpreviewable.tscn` | the two settings that raise an advisory warning |

## Emission shapes
<!-- compare: image=unit-cpuparticles2d-emission-shapes status=done fixture=unit-cpuparticles2d-emission-shapes.tscn -->

## Curves
<!-- compare: image=unit-cpuparticles2d-curves status=done fixture=unit-cpuparticles2d-curves.tscn -->

## Colour ramps
<!-- compare: image=unit-cpuparticles2d-color-ramp status=done fixture=unit-cpuparticles2d-color-ramp.tscn -->

## local_coords
<!-- compare: image=unit-cpuparticles2d-local-coords status=done fixture=unit-cpuparticles2d-local-coords.tscn -->

## emitting = false
<!-- compare: image=unit-cpuparticles2d-not-emitting status=done fixture=unit-cpuparticles2d-not-emitting.tscn -->

Godot draws nothing for an emitter that is neither active nor emitting, and neither does
the previewer. Six of the corpus's eleven `CPUParticles2D` nodes are script-triggered
one-shots that ship this way, so an empty frame here is the correct frame.

## Divergences

Three differences are structural rather than a capture artefact, and hold for
every scene:

- **No motion.** Godot's emitter runs; the previewer shows one moment of it.
  The moment is Godot's own when the scene sets `preprocess` (Godot simulates
  exactly that long before its first frame, at a fixed `1/30 s` step, and only
  at time zero). When it does not, the previewer substitutes one `lifetime` —
  a continuous emitter's steady state — or half a lifetime for a `one_shot`
  burst, which a full lifetime would catch a frame from death.
- **The seed.** Godot randomises `seed` in the constructor unless
  `use_fixed_seed` is set, and never saves it, so two runs of GODOT differ:
  two consecutive reference renders of the isometric candle differ by 187
  pixels, worst channel 20. The previewer substitutes a fixed constant, which
  makes its own output stable but means an unseeded emitter's particles are in
  plausible places rather than the engine's.
- **`speed_scale` on a preprocessed emitter.** Godot forces `speed_scale` to 1
  while it preprocesses, so the property genuinely does not move a preprocessed
  pose; it applies only to the substituted window described above.

## Linting

<!-- lint:begin CPUParticles2D -->
Strict parsing format-checks these `CPUParticles2D` properties, plus 18 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `amount` |
| `angle_curve` |
| `angle_max` |
| `angle_min` |
| `angular_velocity_curve` |
| `angular_velocity_max` |
| `angular_velocity_min` |
| `anim_offset_curve` |
| `anim_offset_max` |
| `anim_offset_min` |
| `anim_speed_curve` |
| `anim_speed_max` |
| `anim_speed_min` |
| `color` |
| `color_initial_ramp` |
| `color_ramp` |
| `damping_curve` |
| `damping_max` |
| `damping_min` |
| `direction` |
| `emission_normals` |
| `emission_points` |
| `emission_rect_extents` |
| `emission_ring_inner_radius` |
| `emission_ring_radius` |
| `emission_shape` |
| `emission_sphere_radius` |
| `emitting` |
| `explosiveness` |
| `fixed_fps` |
| `fract_delta` |
| `gravity` |
| `hue_variation_curve` |
| `hue_variation_max` |
| `hue_variation_min` |
| `initial_velocity_max` |
| `initial_velocity_min` |
| `lifetime` |
| `lifetime_randomness` |
| `linear_accel_curve` |
| `linear_accel_max` |
| `linear_accel_min` |
| `local_coords` |
| `one_shot` |
| `orbit_velocity_curve` |
| `orbit_velocity_max` |
| `orbit_velocity_min` |
| `particle_flag_align_y` |
| `preprocess` |
| `radial_accel_curve` |
| `radial_accel_max` |
| `radial_accel_min` |
| `randomness` |
| `scale_amount_curve` |
| `scale_amount_max` |
| `scale_amount_min` |
| `scale_curve_x` |
| `scale_curve_y` |
| `seed` |
| `speed_scale` |
| `split_scale` |
| `spread` |
| `tangential_accel_curve` |
| `tangential_accel_max` |
| `tangential_accel_min` |
| `texture` |
| `use_fixed_seed` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-cpuparticles2d-preview` | `cpuparticles2d-nondeterministic-emission-shape` | warning |
|  | `cpuparticles2d-fract-delta-ignored` | warning |
<!-- lint:end -->

Where strict validation rejects a value, the lenient parser substitutes Godot's
own constructor default and renders: an unparseable `lifetime` reads as `1.0`,
`spread` as `45.0`, a malformed `gravity` as `Vector2(0, 980)`, an
`emission_shape` outside `0..6` as `POINT`, and an `amount` below 1 clamps to 1
(above 1,000,000 it clamps down, matching Godot's own inspector ceiling).
`draw_order` is deliberately NOT range-validated: Godot's setter accepts any
integer and reads everything but `1` as `Index` — the shipped 2D platformer demo
writes `draw_order = 215832976` — so the lenient parser falls back to `Index`
and the linter says nothing.

## Known limitations

- **`split_scale` / `scale_curve_x` / `scale_curve_y`** are not read. A
  particle scales uniformly from `scale_amount`, so an emitter that stretches
  its quads on one axis draws them square.
- **`emission_shape` POINTS, DIRECTED_POINTS and RING** are not previewed;
  those three sample Godot's process-wide RNG, which no scene file carries, so
  no static pose can match. They emit from the node origin and raise a warning.
- **`fract_delta`** (Godot's default is on) is ignored: the frozen pose steps at
  a fixed rate, so a particle can be up to one frame behind Godot's. Warned
  about when a scene sets it explicitly.
- **`emission_points` / `emission_normals` / `emission_colors`** are validated
  but not consumed, since the shapes that read them are not previewed.
- **`one_shot` completion.** The emitter stops after its first cycle exactly as
  Godot does, but nothing restarts it, so a burst is only ever seen at the
  substituted moment.
