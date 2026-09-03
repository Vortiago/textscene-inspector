---
type: NavigationObstacle3D
category: 3D
status: linter-only
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
| `vertices` | `PackedVector3Array(-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1)` | static obstacle polygon — no runtime visual |
| `velocity` | `Vector3(0.5, 0, 0.25)` | dynamic obstacle velocity hint for avoidance — no runtime visual |
| `avoidance_enabled` | `true` | enables avoidance for the region — no runtime visual |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin NavigationObstacle3D -->
Strict parsing format-checks these `NavigationObstacle3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `affect_navigation_mesh` | true or false |  |
| `avoidance_enabled` | true or false |  |
| `avoidance_layers` | 32-bit layer mask (layers 1-32) |  |
| `carve_navigation_mesh` | true or false |  |
| `height` | float 0-100 | error below, warning above |
| `radius` | float 0-100 | error below, warning above |
| `use_3d_avoidance` | true or false |  |
| `velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `vertices` | PackedVector3Array(x, y, z, …) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-navigationobstacle3d` | `navigationobstacle3d-carve-without-affect` | info |
<!-- lint:end -->

All seven scalar/flag properties (`radius`, `height`, `avoidance_enabled`,
`avoidance_layers`, `affect_navigation_mesh`, `carve_navigation_mesh`,
`use_3d_avoidance`) use the optional readers (`parseOptionalFloat` /
`parseOptionalBool` / `parseOptionalInt`): absent or unparseable values
leave the property unset, silently, with no warning ever emitted. Strict
rejects a negative `radius` or `height` as an error and warns above their
hinted 100 ceiling, since the setter never checks it; the lenient parser has
no bound at all and lets any value through unchanged. `vertices` and
`velocity` are not read by the lenient parser at all — a malformed value for
either never reaches a typed field, regardless of what strict reports.
