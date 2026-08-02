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
Strict parsing format-checks these `NavigationAgent3D` properties, plus 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `avoidance_enabled` | true or false |
| `avoidance_layers` | 32-bit layer mask (layers 1-32) |
| `avoidance_mask` | 32-bit layer mask (layers 1-32) |
| `height` | float >= 0 |
| `max_neighbors` | integer >= 0 |
| `max_speed` | float >= 0 |
| `navigation_layers` | 32-bit layer mask (layers 1-32) |
| `path_desired_distance` | float >= 0 |
| `radius` | float >= 0 |
| `target_desired_distance` | float >= 0 |
| `target_position` | Vector3(x, y, z) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

The ten scalar properties (`radius`, `height`, `avoidance_enabled`,
`avoidance_layers`, `avoidance_mask`, `max_neighbors`, `max_speed`,
`navigation_layers`, `target_desired_distance`, `path_desired_distance`) all
use the optional readers: absent or unparseable values leave the property
unset, silently, with no warning, and none of strict's `min: 0` checks apply,
so a `radius` of `-5` parses through unchanged. `target_position` is the
exception: it parses the `Vector3(...)` literal directly and warns (leaving
the property unset) if the literal is malformed.
