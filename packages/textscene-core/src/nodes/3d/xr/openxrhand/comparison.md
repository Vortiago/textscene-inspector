---
type: OpenXRHand
category: 3D
status: linter-only
fixture: unit-open-xr-hand.tscn
# image: unit-open-xr-hand
visual: false
renders_as: nothing (a transform-only group)
---

# OpenXRHand

Drives a Skeleton3D's bone poses from OpenXR hand tracking. It draws nothing of its own, so the previewer renders it as a transform-only group (ADR-0008). Its children show at the pose the scene file states.

## Linting

<!-- lint:begin OpenXRHand -->
Strict parsing format-checks these `OpenXRHand` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bone_update` | enum 0-1 (Full/Rotation Only) | error |
| `hand` | enum 0-1 (Left/Right) | error |
| `hand_skeleton` | NodePath("path/to/node") |  |
| `motion_range` | enum 0-1 (Unobstructed/Conform to controller) | error |
| `skeleton_rig` | enum 0-1 (OpenXR/Humanoid) | error |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads OpenXRHand through `parseNode3D`, so a malformed `hand`, `motion_range`, `skeleton_rig` or `bone_update` is kept as opaque text with no substitution. There is no tracked pose to fall back to.
