---
type: GPUParticlesAttractorVectorField3D
category: 3D
status: unimplemented
fixture: unit-gpu-particles-attractor-vector-field-3d.tscn
# image: unit-gpu-particles-attractor-vector-field-3d
renders_as: nothing yet, not implemented
---

# GPUParticlesAttractorVectorField3D

A box-shaped attractor that samples a 3D texture to vary attraction strength and direction across its volume, pulling or pushing particles from nearby `GPUParticles3D` nodes; the previewer parses and validates the node but does not yet draw the box or sample the texture, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `size` | `Vector3(3, 1.5, 3)` | The vector field box's extents in 3D units, centered on its origin. |
| `texture` | `SubResource("PlaceholderTexture3D_1")` | The 3D texture sampled across the box; its pixels are linearly interpolated to vary attraction strength and direction by location. |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin GPUParticlesAttractorVectorField3D -->
Strict parsing format-checks these `GPUParticlesAttractorVectorField3D` properties, plus 4 inherited from GPUParticlesAttractor3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `size` | Vector3(x, y, z), each float >= 0.01 |
| `texture` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

`size` is validated as a Vector3 whose components must each be at least 0.01, the
hard floor Godot's PROPERTY_HINT_RANGE hint sets. The stated 1024 upper bound is
soft (or_greater), so no maximum is enforced. `texture` is validated only as a
resource reference (SubResource or ExtResource); the linter does not check that
the referenced resource is actually a Texture3D. All other members come from the
GPUParticlesAttractor3D base tier through the base-walk.
