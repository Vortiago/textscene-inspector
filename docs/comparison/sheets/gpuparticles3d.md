---
type: GPUParticles3D
category: 3D
fixture: unit-gpuparticles3d.tscn
image: unit-gpuparticles3d
renders_as: a transform-only group
---

# GPUParticles3D

A GPU-simulated particle emitter. The previewer treats it as a transform-only
node (ADR-0008) — it does not run the particle simulation, so it draws nothing.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `amount` | `200` | ~200 particles fill the Godot burst |
| `lifetime` | `2.0` | each particle lives 2 s before recycling |
| `preprocess` | `1.2` | simulation runs 1.2 s ahead, so the still catches a spread cloud, not the emission instant |
| `process_material` | `ParticleProcessMaterial` | drives the motion: upward `direction`, 45° `spread`, downward `gravity`, per-particle `scale` 0.5–1.0 |
| `draw_pass_1` | `SphereMesh` (r 0.12) | each particle is drawn as a small sphere |
| `material_override` | emissive `StandardMaterial3D` | tints every particle glowing orange |

## Divergences

The whole particle cloud is missing from our render. Godot shows ~200 orange
emissive spheres spread across the frame; the previewer shows an empty scene —
only the sky gradient and dark ground. GPUParticles3D renders as a
transform-only group (ADR-0008): there is no GPU particle simulation, so none of
the `process_material` motion or `draw_pass_1` mesh is drawn. This absence is the
fixture's deliberate point, not a regression.
