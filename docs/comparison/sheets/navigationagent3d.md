---
type: NavigationAgent3D
category: 3D
fixture: unit-navigation-agent-3d.tscn
image: unit-navigation-agent-3d
renders_as: nothing (non-visual navigation helper)
---

# NavigationAgent3D

A pathfinding and avoidance helper that steers its parent body toward a target. It
has no runtime visual — only an editor-only path debug draw — so the previewer draws
nothing for it. Both images show only the sky gradient over brown ground; the
sibling `CollisionShape3D` is toggle-gated (ADR-0005/0006) and also absent.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `avoidance_enabled` | `true` | none — avoidance is a simulation flag, no runtime visual |
| `max_neighbors` | `1` | none — avoidance tuning, not drawn |
| `radius` | `0.4` | none — avoidance radius, not drawn |

## Divergences

None visible in this fixture.
