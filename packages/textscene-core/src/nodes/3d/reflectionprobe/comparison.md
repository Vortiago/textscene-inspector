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
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and `visible`
and silently ignores every ReflectionProbe-specific key — `intensity = "bright"` or
`ambient_mode = "Environment"` parses with no warning and simply never reaches any
in-memory state, the same as a value Godot's own class never declared.
