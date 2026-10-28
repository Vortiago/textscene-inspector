---
type: Skeleton3D
category: 3D
status: limitation
fixture: unit-mesh-instance-3d-skinned-ribbon.tscn
image: unit-mesh-instance-3d-skinned-ribbon
renders_as: nothing (a transform-only group that poses the meshes bound to it)
---

# Skeleton3D

Holds the bone hierarchy that deforms attached meshes. It draws nothing itself. The previewer poses the bones once at load and binds each MeshInstance3D that names it through `skeleton`, with `skin` unset, to Godot's automatic skin. A binding reaches into and out of an instanced scene. The fixture's ribbon bends where its third bone turns.

## Linting

<!-- lint:begin Skeleton3D -->
Strict parsing format-checks these `Skeleton3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `animate_physical_bones` | true or false |  |
| `bones/*` | leaf `name` (non-empty, no colon or slash), `parent` (int from -1, never the bone itself), `rest` (Transform3D), `enabled` (bool), `position` and `scale` (Vector3), `rotation` (Quaternion), `bone_meta`, or the 3.x `pose` and `bound_children` |  |
| `modifier_callback_mode_process` | enum 0-2 (PHYSICS/IDLE/MANUAL) | warning |
| `motion_scale` | float >= 0.001 | error at or below 0, warning below 0.001 |
| `show_rest_only` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeleton3d-usage` | `skeleton3d-debug-mode` | info |
|  | `skeleton3d-deprecated-feature` | warning |
|  | `skeleton3d-deprecated-bone-pose` | warning |
|  | `skeleton3d-bone-name-order` | error |
|  | `skeleton3d-duplicate-bone-name` | error |
<!-- lint:end -->

The parser reads `show_rest_only` and the bone table: `name`, `parent`, `rest`, `enabled`, `position`, `rotation` and `scale`. It does not read `motion_scale`, `animate_physical_bones` or `modifier_callback_mode_process`, which never move a frozen frame.

## Known limitations

- **Needs runtime** Godot runs the skeleton's modifiers and animation each frame, but here the bones hold the pose the file writes.
- **Approximated** Only a RibbonTrailMesh deforms, as no other mesh writes bone arrays, so every other mesh bound to a skeleton draws in its rest pose.
- **Approximated** A bone past the skin's last index collapses its vertices, where Godot's result depends on the GPU driver.
- **Editor only** The bone gizmo appears only in Godot's editor, but here it is absent.
- **Not drawn** A scene override of `show_rest_only`, `motion_scale` or `bones/*` on a `Skeleton3D` in an instanced GLB is ignored with a warning, where Godot reads it.
