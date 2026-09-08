---
type: SkeletonModifier3D
category: 3D
status: linter-only
fixture: unit-skeleton-modifier-3d.tscn
# image: unit-skeleton-modifier-3d
visual: false
renders_as: a transform-only group
---

# SkeletonModifier3D

The base class custom skeleton modifiers derive from, feeding a parent Skeleton3D's bone poses each frame. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin SkeletonModifier3D -->
Strict parsing format-checks these `SkeletonModifier3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `active` | true or false |  |
| `influence` | float 0-1 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-skeletonmodifier3d-parent` (type-family match) | `skeletonmodifier3d-parent-not-skeleton3d` | warning |
<!-- lint:end -->

SkeletonModifier3D registers `parseNode3D` directly, so `active` and `influence` are never read. An `influence = 5.0` or an `active = "maybe"` is dropped silently, and only strict reports it.
