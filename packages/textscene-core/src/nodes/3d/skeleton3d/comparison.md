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

A Skeleton3D holds the bone hierarchy that deforms attached meshes. On its own it
has no runtime visual — the bones are an editor gizmo. The previewer reuses the
Node3D component (ADR-0008), so the node contributes only its transform; with no
bone-driven `MeshInstance3D` beneath it, it draws nothing.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1,0,0, 0,1,0, 0,0,1, 0,2,0)` | positions the (empty) skeleton 2 units up — no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Skeleton3D -->
Strict parsing format-checks these `Skeleton3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `animate_physical_bones` | true or false |  |
| `bones/*` | bone pose component (float, Vector3 or Quaternion) |  |
| `modifier_callback_mode_process` | enum 0-2 (PHYSICS/IDLE/MANUAL) | warning |
| `motion_scale` | float >= 0.001 | error at or below 0, warning below 0.001 |
| `show_rest_only` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeleton3d-usage` | `skeleton3d-debug-mode` | warning |
|  | `skeleton3d-deprecated-feature` | warning |
<!-- lint:end -->

Skeleton3D has no `parser.ts` of its own: it registers `parseNode3D` directly (index.ts),
so `motion_scale`, `show_rest_only`, `animate_physical_bones`,
`modifier_callback_mode_process`, and every `bones/*` key are never read at all, valid or
not. Nothing warns and nothing substitutes a default, since the lenient parser only ever
sees the inherited Node3D transform here, consistent with the node rendering as a
transform-only group (ADR-0008).
