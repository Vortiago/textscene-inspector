---
type: NavigationAgent3D
category: 3D
status: linter-only
fixture: unit-navigation-agent-3d.tscn
image: unit-navigation-agent-3d
visual: false
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

## Linting

<!-- lint:begin NavigationAgent3D -->
Strict parsing format-checks these `NavigationAgent3D` properties. Every validator failure is an **error**.

| Property |
| --- |
| `avoidance_enabled` |
| `avoidance_layers` |
| `avoidance_mask` |
| `height` |
| `max_neighbors` |
| `max_speed` |
| `navigation_layers` |
| `path_desired_distance` |
| `radius` |
| `target_desired_distance` |
| `target_position` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

The ten scalar properties (`radius`, `height`, `avoidance_enabled`,
`avoidance_layers`, `avoidance_mask`, `max_neighbors`, `max_speed`,
`navigation_layers`, `target_desired_distance`, `path_desired_distance`) all
use the optional readers: absent or unparseable values leave the property
unset, silently, with no warning, and none of strict's `min: 0` checks apply,
so a `radius` of `-5` parses through unchanged. `target_position` is the
exception: it parses the `Vector3(...)` literal directly and warns (leaving
the property unset) if the literal is malformed.
