---
type: OccluderInstance3D
category: 3D
status: linter-only
fixture: unit-occluder-instance-3d.tscn
# image: unit-occluder-instance-3d
visual: false
renders_as: nothing (a transform-only group)
---

# OccluderInstance3D

This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `occluder` | `SubResource("BoxOccluder3D_1")` | the baked occluder shape; invisible here since the node draws nothing itself |
| `bake_mask` | `3` | which visual layers count toward baking; invisible here since the node draws nothing itself |
| `bake_simplification_distance` | `0.05` | simplification distance for the baked occluder mesh; invisible here since the node draws nothing itself |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin OccluderInstance3D -->
Strict parsing format-checks these `OccluderInstance3D` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bake_mask` | 32-bit layer mask (layers 1-32) |  |
| `bake_simplification_distance` | float 0-2 | error below, warning above |
| `occluder` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-occluderinstance3d-configuration` | `occluderinstance3d-empty-bake-mask` | warning |
|  | `occluderinstance3d-missing-occluder` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode3D`, which reads only `transform` and
`visible` and silently ignores every OccluderInstance3D-specific key: a
malformed `bake_mask = "off"` or an out-of-range `bake_simplification_distance
= -5` parses with no warning and never reaches any in-memory state at all —
not read, not stored, not substituted — the same as a value Godot's own class
never declared. Strict parsing reports the same bad value as a diagnostic
instead of silently dropping it.
