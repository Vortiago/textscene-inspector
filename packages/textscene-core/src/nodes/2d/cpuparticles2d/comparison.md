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
| `unit-cpuparticles2d-unpreprocessed.tscn` | no `preprocess`, so the settle window is substituted rather than read |
| `unit-cpuparticles2d-unpreviewable.tscn` | the two settings that raise an advisory warning |

## Emission shapes
<!-- compare: image=unit-cpuparticles2d-emission-shapes status=done fixture=unit-cpuparticles2d-emission-shapes.tscn -->

## Curves
<!-- compare: image=unit-cpuparticles2d-curves status=done fixture=unit-cpuparticles2d-curves.tscn -->

## Colour ramps
<!-- compare: image=unit-cpuparticles2d-color-ramp status=done fixture=unit-cpuparticles2d-color-ramp.tscn -->

## local_coords
<!-- compare: image=unit-cpuparticles2d-local-coords status=done fixture=unit-cpuparticles2d-local-coords.tscn -->

## No preprocess
<!-- compare: image=unit-cpuparticles2d-unpreprocessed status=done fixture=unit-cpuparticles2d-unpreprocessed.tscn particles=0.95 -->

An emitter that authors no `preprocess` names no instant, so the previewer picks
one: **one `lifetime`**, where a continuous emitter reaches steady state, halved
for a `one_shot` burst so it is caught mid-flight. This fixture's lifetime is
`0.95 s`, and the pair above is both sides AT that instant — Godot was asked for
it explicitly, with `pnpm ref:godot … --particles 0.95`.

That flag exists because the two Godots disagree. `godot --path` runs the GAME,
where a paused emitter sits at frame 0; the EDITOR animates it, since
`CPUParticles2D`'s ENTER_TREE arm is a bare `set_process_internal(emitting)` with
no `is_editor_hint` guard. The previewer mirrors the editor, so the reference has
to move rather than the pose being bent to a picture Godot never shows anyone.
`request_particles_process` is Godot's own API for asking an emitter to spend a
named number of seconds inside one frame, through the identical loop it spends
`preprocess` through. Measured: deleting a fixture's `preprocess` line and
passing that same number to `--particles` renders **byte-identical** pixels, so
the substituted window is a `preprocess` in everything except where the number
came from.

Which is what makes the substituted window a settle rather than "some frames in":
whole `fixed_fps` steps, `speed_scale` held at 1, the last step overshooting.
`0.95 s` at 30 fps is 28.5 steps, so both sides take 29 and land at `0.9667 s`.

## emitting = false
<!-- compare: image=unit-cpuparticles2d-not-emitting status=done fixture=unit-cpuparticles2d-not-emitting.tscn -->

Godot draws nothing for an emitter that is neither active nor emitting, and neither does
the previewer. Six of the corpus's eleven `CPUParticles2D` nodes are script-triggered
one-shots that ship this way, so an empty frame here is the correct frame.

## Divergences

Measured whole-frame against Godot 4.6.3, `pnpm ref:godot <fixture> --mode 2d` against
`pnpm ref:ours <fixture> --2d`, 1152x648:

| Fixture | Instant | Differing pixels |
| --- | --- | --- |
| `unit-cpuparticles2d-emission-shapes.tscn` | `preprocess = 0.0334` | 0 (0.000 %) |
| `unit-cpuparticles2d-unpreprocessed.tscn` | `--particles 0.95` | 873 (0.117 %) |
| `unit-cpuparticles2d.tscn` | `preprocess = 1.5` | 1398 (0.187 %) |
| `unit-cpuparticles2d-color-ramp.tscn` | `preprocess = 2.0` | 3490 (0.468 %) |
| `unit-cpuparticles2d-local-coords.tscn` | `preprocess = 1.0` | 4777 (0.640 %) |

The zero is the load-bearing one: it is the same simulation on both sides, stepped the same
way, landing on the same pose to the pixel. So the rest is not the emitter's motion — it is
what those fixtures add on top of it. In `local_coords`, the largest, the two streams
have the same extent and position on both sides but ours breaks into a comb of separate quads
where Godot's is one solid bar, i.e. our particles sit further apart along the stream. The
unpreprocessed fixture's 873 px are the same class, confined to `x 530..622, y 288..437` —
the spray column itself, with every backdrop pixel matching.

Two more things are structural rather than a capture artefact:

- **The seed.** Godot randomises `seed` in the constructor unless
  `use_fixed_seed` is set, and never saves it, so an unseeded emitter that has
  a `preprocess` to simulate draws a different reference every run. Every
  fixture here pins both, which is what makes these poses comparable at all.
  The previewer substitutes a fixed constant, which makes its own output stable
  but means an unseeded emitter's particles are in plausible places rather than
  the engine's.
- **A scene whose emitters carry different lifetimes holds several instants at
  once.** The substituted window is per emitter, so a candle with a 0.8 s flame
  beside a 1.0 s sparkle settles each to its own lifetime — which is what a
  viewer expects of a scene where every emitter is simply running. A reference
  render cannot be asked for that: `--particles` is one number for the whole
  scene. Such a scene is therefore not arbitrable as a whole, and the behaviour
  is measured on a single-instant fixture instead. Scenes that author
  `preprocess` are unaffected, since each emitter's instant is then in the file
  and Godot reads it per node.

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
- **The pose does not move over time.** Godot's editor animates an emitter on
  wall clock; the previewer settles it once and holds it. `speed_scale` is
  therefore invisible here — Godot itself forces it to 1 while it settles, so it
  decides how fast a running emitter reaches a pose, never which pose that is.
