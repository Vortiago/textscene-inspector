---
type: ReflectionProbe
category: 3D
renders_as: a capture of the scene, baked into an atlas layer that lit surfaces in its box read
---

# ReflectionProbe

Captures the scene around it in six directions and gives each lit surface inside its box the
capture's reflection and ambient light. The previewer captures each probe once, after the scene's
meshes and textures load.

## Two overlapping probes
<!-- compare: image=unit-reflection-probe-always status=unreviewed fixture=unit-reflection-probe-always.tscn -->

Two probes that update ALWAYS share the floor. Each probe captures the blue background. The floor
takes that capture as its ambient light and its reflection, so the floor and the shadow turn blue.

## Box projection
<!-- compare: image=unit-reflection-probe-box-projection status=unreviewed fixture=unit-reflection-probe-box-projection.tscn -->

One probe that updates ONCE projects its reflection onto its box. The mirror sphere reflects the
floor, the glowing box and the background where its reflection leaves the box.

## Colour ambient
<!-- compare: image=unit-reflection-probe-ambient-color status=unreviewed fixture=unit-reflection-probe-ambient-color.tscn -->

One probe sets its ambient to red. The floor inside its box takes the red as its ambient light.

## Gizmo

A selected probe draws the gizmo of Godot's editor in the probe colour. Godot's source is `reflection_probe_gizmo_plugin.cpp:149-212`.

- The 12 edges of the box inset by `blend_distance`. A `blend_distance` of 0 draws no box.
- Eight lines at half opacity, from each corner of the inset box to the matching corner of the outer box.
- A cross of three segments of 0.5 centred on `origin_offset`, drawn only when the offset is not 0.

Godot draws no edge of the outer box. An axis where the inset passes the middle of the box collapses to the middle, with a size of 0. The previewer draws no edit handles and no billboard icon.

## Linting

<!-- lint:begin ReflectionProbe -->
Strict parsing format-checks these `ReflectionProbe` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `ambient_color` | Color(r, g, b, a), or the colour string or int it converts |  |
| `ambient_color_energy` | float 0-16 | warning |
| `ambient_mode` | enum 0-2 (AMBIENT_DISABLED/AMBIENT_ENVIRONMENT/AMBIENT_COLOR) | warning |
| `blend_distance` | float >= 0 | warning below |
| `box_projection` | true or false |  |
| `cull_mask` | 32-bit layer mask (layers 1-32) |  |
| `enable_shadows` | true or false |  |
| `intensity` | float 0-1 | warning |
| `interior` | true or false |  |
| `max_distance` | float 0-262144 | error below 0, error above 262144 |
| `mesh_lod_threshold` | float 0-1024 | warning |
| `origin_offset` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `reflection_mask` | 32-bit layer mask (layers 1-32) |  |
| `size` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `update_mode` | enum 0-1 (UPDATE_ONCE/UPDATE_ALWAYS) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-reflectionprobe-properties` | `reflectionprobe-ambient-color-no-effect` | info |
|  | `reflectionprobe-origin-offset-clamped` | warning |
<!-- lint:end -->

The lenient parser reads every property above. A malformed value keeps Godot's default, a
`max_distance` above 262144 clamps to it, and an `ambient_mode` outside 0 to 2 reads as
`AMBIENT_DISABLED`.

## Known limitations

- **Editor only** Godot's editor also draws the blend box and origin cross of an unselected probe at 0.3 alpha (`node_3d_editor_gizmos.cpp:919-920`), where ADR-0018 draws it only when selected.
- **Approximated** A probe that updates ALWAYS captures once, so it does not follow a moving node.
