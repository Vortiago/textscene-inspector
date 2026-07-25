---
type: NavigationObstacle3D
category: 3D
fixture: unit-navigation-obstacle-3d.tscn
image: unit-navigation-obstacle-3d
visual: false
renders_as: a transform-only group (no runtime visual)
---

# NavigationObstacle3D

NavigationObstacle3D defines an avoidance region for navigation agents. It has no
runtime visual — the previewer draws it as a transform-only Node3D group
(ADR-0008), so nothing appears. Both images show only the shared editor sky and
ground; the fixture's sibling CollisionShape3D is toggle-gated and also draws
nothing in a plain capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `radius` | `1.5` | avoidance region radius — no runtime visual |
| `height` | `2.0` | avoidance region height — no runtime visual |
| `avoidance_enabled` | `true` | enables avoidance for the region — no runtime visual |

## Divergences

None visible in this fixture.
