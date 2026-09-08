---
type: Skeleton3D
category: 3D
status: linter-only
fixture: unit-skeleton3d.tscn
image: unit-skeleton3d
visual: false
renders_as: a transform-only group
---

# Skeleton3D

Holds the bone hierarchy that deforms attached meshes. The bones themselves are an editor gizmo, so the previewer reuses the Node3D component (ADR-0008) and the node contributes only its transform.

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

Skeleton3D registers `parseNode3D` directly, so `motion_scale`, `show_rest_only`, `animate_physical_bones`, `modifier_callback_mode_process` and every `bones/*` key are never read by the lenient parser. Nothing warns and nothing substitutes a default.

## Known limitations

- **Editor only** The bone gizmo appears only in Godot's editor. Here it is absent.
