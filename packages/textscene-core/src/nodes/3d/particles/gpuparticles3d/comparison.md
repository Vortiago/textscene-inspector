---
type: GPUParticles3D
category: 3D
status: unimplemented
fixture: unit-gpuparticles3d.tscn
image: unit-gpuparticles3d
renders_as: nothing yet — Godot draws a particle cloud, the previewer does not
---

# GPUParticles3D

A GPU-simulated particle emitter. The previewer renders it as a transform-only
node (ADR-0008) — it does not run the particle simulation, so it contributes no
visible geometry to the frame.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `amount` | `200` | up to 200 particles fill Godot's burst |
| `lifetime` | `2.0` | each particle lives 2 s before recycling |
| `preprocess` | `1.2` | the sim runs 1.2 s ahead, so the still catches a spread cloud, not the emission instant |
| `process_material` | `ParticleProcessMaterial` | drives the motion: upward `direction`, 45° `spread`, downward `gravity`, per-particle `scale` 0.5–1.0 |
| `draw_pass_1` | `SphereMesh` (radius 0.12) | each particle is drawn as a small sphere |
| `material_override` | emissive `StandardMaterial3D` | tints every particle glowing orange |

## Divergences

Godot draws the whole particle burst; the previewer draws none of it. Godot's
frame is a spread of ~200 orange emissive spheres of varying sizes fanning up
and out from the emitter (the `preprocess` seek catches them mid-flight); ours
shows only the sky gradient and dark ground with no particles at all.
GPUParticles3D renders as a transform-only group (ADR-0008): there is no GPU
particle simulation, so neither the `process_material` motion nor the
`draw_pass_1` mesh appears. This absence is the fixture's deliberate point, not a
regression.

## Linting

<!-- lint:begin GPUParticles3D -->
Strict parsing format-checks these `GPUParticles3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `amount` | integer > 0 |
| `collision_base_size` | float >= 0 |
| `draw_order` | enum 0-3 (INDEX/LIFETIME/REVERSE_LIFETIME/VIEW_DEPTH) |
| `draw_pass_1` | SubResource("id") or ExtResource("id") |
| `emitting` | true or false |
| `explosiveness` | float 0-1 |
| `fixed_fps` | integer 0-1000 |
| `fract_delta` | true or false |
| `interp_to_end` | float 0-1 |
| `lifetime` | float > 0 |
| `local_coords` | true or false |
| `one_shot` | true or false |
| `preprocess` | float >= 0 |
| `process_material` | SubResource("id") or ExtResource("id") |
| `randomness` | float 0-1 |
| `speed_scale` | float 0-64 |
| `sub_emitter` | NodePath("path/to/node") |
| `trail_enabled` | true or false |
| `trail_lifetime` | float >= 0.01 |
| `visibility_aabb` | AABB(x, y, z, w, h, d) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-gpuparticles3d-resources` | `gpuparticles3d-missing-process-material` | warning |
|  | `valid-gpuparticles3d-process-material` | error |
|  | `valid-gpuparticles3d-resources` | error |
|  | `gpuparticles3d-no-draw-pass-mesh` | warning |
|  | `valid-gpuparticles3d-sub-emitter` | error |
|  | `gpuparticles3d-sub-emitter-wrong-type` | warning |
|  | `gpuparticles3d-performance` | warning |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

GPUParticles3D has no `parser.ts` of its own: registration wires `parseNode3D`
straight in, reusing Node3D's parse verbatim. None of the properties validated
above, including `amount`, `lifetime`, `process_material`, `draw_pass_1`, and
`visibility_aabb`, are read by the lenient parser at all, so an invalid or
missing value has no lenient-side effect; only the inherited `transform` and
`visible` are parsed.
