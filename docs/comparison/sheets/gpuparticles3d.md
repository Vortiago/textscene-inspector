---
type: GPUParticles3D
category: 3D
fixture: unit-gpuparticles3d.tscn
image: unit-gpuparticles3d
renders_as: a transform-only group
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
