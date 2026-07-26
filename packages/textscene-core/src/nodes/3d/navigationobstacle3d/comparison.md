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

## Linting

<!-- lint:begin NavigationObstacle3D -->
Strict parsing format-checks these `NavigationObstacle3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `affect_navigation_mesh` |
| `avoidance_enabled` |
| `avoidance_layers` |
| `carve_navigation_mesh` |
| `height` |
| `radius` |
| `use_3d_avoidance` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

All seven properties (`radius`, `height`, `avoidance_enabled`,
`avoidance_layers`, `affect_navigation_mesh`, `carve_navigation_mesh`,
`use_3d_avoidance`) use the optional readers (`parseOptionalFloat` /
`parseOptionalBool` / `parseOptionalInt`): absent or unparseable values
leave the property unset, silently, with no warning ever emitted. Strict
rejects a negative `radius` or `height` as an error; the lenient parser has
no minimum check and lets a negative value through unchanged.
