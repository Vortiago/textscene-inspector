---
type: GPUParticlesCollisionHeightField3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-height-field-3d.tscn
# image: unit-gpu-particles-collision-height-field-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionHeightField3D

A real-time heightmap collision shape that particles emitted by nearby `GPUParticles3D` nodes collide with; the previewer parses and validates the node but does not yet generate or draw the heightmap, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| size | Vector3(8, 4, 8) | The collision heightmap's size in 3D units. |
| resolution | 3 (2048) | The heightmap texture resolution used to represent collision detail. |
| update_mode | 1 (Always) | When the heightmap regenerates: on movement only, or every frame. |
| follow_camera_enabled | true | Whether the heightmap follows the current camera in global space. |
| heightfield_mask | 3 | Which visual layers' MeshInstance3D geometry contributes to the heightmap. |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin GPUParticlesCollisionHeightField3D -->
Strict parsing format-checks these `GPUParticlesCollisionHeightField3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `follow_camera_enabled` | true or false |  |
| `heightfield_mask` | 32-bit layer mask (layers 1-32) | warning |
| `resolution` | enum 0-5 (256/512/1024/2048/4096/8192) | warning |
| `size` | Vector3(x, y, z), each float >= 0.01 | warning below |
| `update_mode` | enum 0-1 (WHEN_MOVED/ALWAYS) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

GPUParticlesCollisionHeightField3D registers 5 own validators (size, resolution,
update_mode, follow_camera_enabled, heightfield_mask), plus the inherited
cull_mask from GPUParticlesCollision3D, so the strict and lenient parsers
diverge: the lenient parser reads whatever `parser.ts` (the shared Node3D
parse) accepts, while the strict parser now format- and range-checks all six
keys above. The `## Linting` block itself is generated from the live linter
registries by `pnpm docs:lint-sections`, which needs a built core, so it is
left empty here pending that regeneration pass.
