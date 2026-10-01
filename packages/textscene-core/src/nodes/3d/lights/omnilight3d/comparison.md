---
type: OmniLight3D
category: 3D
status: unreviewed
fixture: unit-omni-light-3d.tscn
image: unit-omni-light-3d
renders_as: a THREE.PointLight
---

# OmniLight3D

Godot's omnidirectional point light, emitting from a single point in every direction with distance attenuation. The previewer renders it as a `THREE.PointLight` inside the node's transform group, with energy scaled by PI to match Godot's brightness.

## Linting

<!-- lint:begin OmniLight3D -->
Strict parsing format-checks these `OmniLight3D` properties, plus 27 inherited from Light3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `omni_attenuation` | float |  |
| `omni_range` | float >= 0 | warning below |
| `omni_shadow_mode` | enum 0-1 (DUAL_PARABOLOID/CUBE) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-omnilight3d-properties` | `omnilight3d-projector-without-shadow` | warning |
| `valid-light3d-scale` (type-family match) | `light3d-non-unit-scale` | warning |
<!-- lint:end -->

The lenient parser falls back silently when `omni_range` or `omni_attenuation` is absent, and warns then falls back to `5.0` and `1.0` when one is present but unparseable. `omni_shadow_mode` goes through `parseOptionalInt`, so an absent or invalid value quietly becomes `undefined`.

The shadow map takes the slot that Godot's positional shadow atlas gives the light for the camera. A light that covers less of the view gets a smaller slot and a coarser, softer shadow. The soft edge spans the angle of `shadow_blur` times two texels of that slot, the radius of Godot's default Soft Low filter.

## Known limitations

- **Approximated** Distance falloff follows three's inverse-square curve rather than Godot's, so the mid-range brightness differs.
- **Approximated** The soft edge takes five filter taps on a cube map, where Godot takes four on two paraboloids, so its dither pattern differs.
- **Approximated** At a large `shadow_blur`, the grain where a surface shadows itself covers a different area than in Godot.
- **Approximated** A light keeps its slot size when other lights fill that part of the atlas, where Godot moves it to a smaller slot.
- **Editor only** The wireframe sphere gizmo appears only in Godot's editor. Here it is selection-gated.
