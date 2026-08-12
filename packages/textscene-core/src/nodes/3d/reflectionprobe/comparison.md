---
type: ReflectionProbe
category: 3D
status: unimplemented
fixture: unit-reflection-probe.tscn
# image: unit-reflection-probe
renders_as: invisible transform-only fallback
---

# ReflectionProbe

Captures its surroundings as a cubemap to fake accurate reflections at a low
performance cost. The previewer parses and validates this node but does not draw it
yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| update_mode | `1` (UPDATE_ALWAYS) | Refreshes the reflection every frame instead of once. |
| intensity | `0.8` | Scales the strength of the reflection. |
| blend_distance | `4.0` | Meters over which this probe blends into the scene/neighbouring probes. |
| max_distance | `20000.0` | Objects beyond this distance are culled from the reflection. |
| size | `Vector3(30, 10, 30)` | The probe's box extents. |
| origin_offset | `Vector3(2, 1, 2)` | Shifts the reflection center for box projection, within the box. |
| box_projection | `true` | Offsets the reflection to better fit a rectangular room. |
| interior | `true` | Ignores sky contribution in the reflection. |
| enable_shadows | `true` | Computes shadows inside the reflection (slower). |
| cull_mask | `1048575` | All 20 3D render layers are rendered by the probe. |
| reflection_mask | `4294967295` | The widest 32-bit mask value — every bit set, beyond the 20 checkboxes the 3D-render layer widget itself exposes. |
| mesh_lod_threshold | `500.0` | LOD bias for meshes rendered inside the probe. |
| ambient_mode | `2` (AMBIENT_COLOR) | Uses the custom `ambient_color`/`ambient_color_energy` below instead of environment lighting. |
| ambient_color | `Color(0.1, 0.2, 0.3, 1)` | Custom ambient color inside the probe's box. |
| ambient_color_energy | `5.0` | Custom ambient color's energy multiplier. |

## Divergences

None visible in this fixture.

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
| `cull_mask` | 32-bit layer mask (layers 1-32) | warning |
| `enable_shadows` | true or false |  |
| `intensity` | float 0-1 | warning |
| `interior` | true or false |  |
| `max_distance` | float 0-262144 | error |
| `mesh_lod_threshold` | float 0-1024 | warning |
| `origin_offset` | Vector3(x, y, z) |  |
| `reflection_mask` | 32-bit layer mask (layers 1-32) | warning |
| `size` | Vector3(x, y, z) |  |
| `update_mode` | enum 0-1 (UPDATE_ONCE/UPDATE_ALWAYS) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-reflectionprobe-ambient-mode` | `reflectionprobe-ambient-color-no-effect` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`
and silently ignores every ReflectionProbe-specific key — `intensity = "bright"` or
`ambient_mode = "Environment"` parses with no warning and simply never reaches any
in-memory state, the same as a value Godot's own class never declared.
