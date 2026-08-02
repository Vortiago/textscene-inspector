---
type: GPUParticlesCollisionSDF3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-collision-sdf-3d.tscn
# image: unit-gpu-particles-collision-sdf-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesCollisionSDF3D

The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `size` | `Vector3(4, 2, 4)` | Extents of the baked SDF volume in 3D units |
| `resolution` | `2` (index for 64³) | Bake resolution of the SDF texture |
| `thickness` | `0.5` | Hollow-shell thickness used to prevent particle tunneling |
| `bake_mask` | `3` | Visual layers considered when baking the SDF |
| `texture` | `ExtResource("1_sdf")` | Baked signed distance field texture |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin GPUParticlesCollisionSDF3D -->
Strict parsing format-checks these `GPUParticlesCollisionSDF3D` properties, plus 1 inherited from GPUParticlesCollision3D, 1 inherited from VisualInstance3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `bake_mask` | 32-bit layer mask (layers 1-32) |
| `resolution` | enum 0-5 (16/32/64/128/256/512) |
| `size` | Vector3(x, y, z), each float >= 0.01 |
| `texture` | SubResource("id") or ExtResource("id") |
| `thickness` | float 0-2 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-gpuparticlescollisionsdf3d-bake-mask` (type-family match) | `gpuparticlescollisionsdf3d-empty-bake-mask` | warning |
<!-- lint:end -->

`size`, `resolution`, `thickness`, `bake_mask`, and `texture` are validated as shown
above; `cull_mask` and the rest come from the GPUParticlesCollision3D base tier
through the base-walk. GPUParticlesCollisionSDF3D has no `parser.ts` of its own (it
registers `parseNode3D` directly, per index.ts), so none of these five are ever read
by the lenient parser, valid or not: an out-of-range `resolution` or a malformed
`size` is silently dropped rather than substituted or warned on, consistent with the
node rendering as an invisible transform-only fallback.
