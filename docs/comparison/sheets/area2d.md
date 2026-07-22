---
type: Area2D
category: 2D
fixture: unit-area2d.tscn
image: unit-area2d
renders_as: a transform-only Node2D group
---

# Area2D

Area2D is a 2D physics region that detects overlaps. Like every physics body it
has no runtime visual, so the previewer mounts it as a transform-only Node2D
group (ADR-0005/ADR-0008) and draws nothing for it. Both captures are an empty
grey frame.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `position` | `Vector2(10, 20)` | shifts the invisible node; no pixels |
| `collision_layer` | `4` | physics config; not drawn |
| `collision_mask` | `1` | physics config; not drawn |
| `monitoring` | `true` | physics config; not drawn |
| `monitor_neighbors` | `true` | physics config; not drawn |

The child `CollisionShape2D` (a `CircleShape2D`) is a selection-gated gizmo and
does not appear in a plain capture. The child `ColorRect` (color
`Color(1, 0.4, 0.4, 1)`) carries no size, so its rect is empty and it too draws
nothing.

## Divergences

None visible in this fixture.
