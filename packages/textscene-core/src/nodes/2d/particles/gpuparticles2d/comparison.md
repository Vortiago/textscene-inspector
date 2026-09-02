---
type: GPUParticles2D
category: 2D
status: unimplemented
fixture: unit-gpu-particles-2d.tscn
# image: unit-gpu-particles-2d
renders_as: nothing yet — Godot draws a particle cloud, the previewer does not
---

# GPUParticles2D

Godot draws a particle cloud from this emitter; the previewer does not yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `emitting` | `true` | the emitter is active |
| `amount` | `64` | up to 64 particles fill one emission cycle |
| `amount_ratio` | `0.8` | only 80% of `amount` are actually emitted |
| `lifetime` | `2.0` | each particle lives 2 s before recycling |
| `one_shot` | `false` | the emitter loops continuously rather than firing once |
| `preprocess` | `1.0` | the sim runs 1 s ahead before the first frame |
| `interp_to_end` | `0.25` | particles interpolate a quarter of the way toward end-of-life pose |
| `speed_scale` | `1.0` | simulation runs at normal speed |
| `explosiveness` | `0.2` | a slight gap between emission bursts |
| `randomness` | `0.1` | a little variance in per-particle lifetime |
| `use_fixed_seed` | `true` | the seed below is actually used |
| `seed` | `4242` | the run is reproducible across replays |
| `fixed_fps` | `30` | the sim steps at a fixed 30 FPS |
| `interpolate` | `true` | inter-frame motion is smoothed |
| `fract_delta` | `true` | a restarting particle takes a fractional first step |
| `collision_base_size` | `1.0` | default collision radius multiplier |
| `visibility_rect` | `Rect2(-100, -100, 200, 200)` | the emitter stays active while this rect is on screen |
| `local_coords` | `false` | particles move in global space, independent of the emitter's own transform |
| `draw_order` | `1` | draws by remaining lifetime (unvalidated range, see Linting) |
| `trail_enabled` | `true` | each particle carries a mesh-skinned trail |
| `trail_lifetime` | `0.3` | the trail represents 0.3 s of motion |
| `trail_sections` | `8` | the trail mesh has 8 sections |
| `trail_section_subdivisions` | `4` | each trail section is subdivided 4 times |
| `process_material` | `ParticleProcessMaterial` | drives motion: downward spread cone, upward `gravity`, 40–80 initial velocity |

## Divergences

None visible in this fixture.

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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-gpuparticles2d-process-material` | `gpuparticles2d-missing-process-material` | warning |
<!-- lint:end -->

Every own member above gets a validator except `draw_order`: its setter takes
any int with no ERR_FAIL_INDEX or clamp, exactly like CPUParticles2D's
identically-named property, so a range check would fail scenes Godot itself
opens without complaint. `linter.ts` adds one advisory: Godot's own
`get_configuration_warnings` flags a GPUParticles2D with no `process_material`
assigned, which this fixture avoids by attaching one.
