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
Strict parsing format-checks these `GPUParticles3D` properties, plus 1 inherited from VisualInstance3D, 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `amount` |
| `collision_base_size` |
| `draw_order` |
| `draw_pass_1` |
| `emitting` |
| `explosiveness` |
| `fixed_fps` |
| `fract_delta` |
| `interp_to_end` |
| `lifetime` |
| `local_coords` |
| `one_shot` |
| `preprocess` |
| `process_material` |
| `randomness` |
| `speed_scale` |
| `sub_emitter` |
| `trail_enabled` |
| `trail_lifetime` |
| `visibility_aabb` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-gpuparticles3d-resources` | `valid-gpuparticles3d-process-material` | error |
|  | `valid-gpuparticles3d-resources` | error |
|  | `valid-gpuparticles3d-trail-config` | error |
|  | `valid-gpuparticles3d-sub-emitter` | error |
|  | `gpuparticles3d-performance` | warning |
<!-- lint:end -->

GPUParticles3D has no `parser.ts` of its own: registration wires `parseNode3D`
straight in, reusing Node3D's parse verbatim. None of the properties validated
above, including `amount`, `lifetime`, `process_material`, `draw_pass_1`, and
`visibility_aabb`, are read by the lenient parser at all, so an invalid or
missing value has no lenient-side effect; only the inherited `transform` and
`visible` are parsed.
