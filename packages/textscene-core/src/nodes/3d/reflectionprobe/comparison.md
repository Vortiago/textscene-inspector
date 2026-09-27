---
type: ReflectionProbe
category: 3D
status: unimplemented
fixture: unit-reflection-probe.tscn
# image: unit-reflection-probe
renders_as: invisible transform-only fallback
---

# ReflectionProbe

Captures its surroundings as a cubemap so nearby materials reflect them at low cost. The previewer does not draw it yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin ReflectionProbe -->
Strict parsing format-checks these `ReflectionProbe` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `ambient_color` | Color(r, g, b, a) |  |
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

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`. An `intensity = "bright"` or `ambient_mode = "Environment"` parses with no warning and reaches no in-memory state.

## Known limitations

- **Not drawn** Godot applies the probe's reflection to surfaces inside its box. Here they get none.
