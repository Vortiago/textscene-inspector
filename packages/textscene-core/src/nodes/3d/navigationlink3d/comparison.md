---
type: NavigationLink3D
category: 3D
status: linter-only
fixture: unit-navigation-link-3d.tscn
# image: unit-navigation-link-3d
visual: false
renders_as: nothing (a transform-only group)
---

# NavigationLink3D

This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enabled` | `true` | link participates in pathfinding — no runtime visual |
| `bidirectional` | `true` | link may be traveled start-to-end and end-to-start — no runtime visual |
| `navigation_layers` | `3` | layers 1 and 2 of the 32-bit navigation mask — no runtime visual |
| `start_position` | `Vector3(-1, 0, 0)` | link's local start point — no runtime visual |
| `end_position` | `Vector3(2, 0, 0)` | link's local end point — no runtime visual |
| `enter_cost` | `0.5` | pathfinding cost added on entering the link — no runtime visual |
| `travel_cost` | `2.0` | pathfinding cost multiplier while traveling the link — no runtime visual |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin NavigationLink3D -->
Strict parsing format-checks these `NavigationLink3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bidirectional` | true or false |  |
| `enabled` | true or false |  |
| `end_position` | Vector3(x, y, z) |  |
| `enter_cost` | float >= 0 | error below |
| `navigation_layers` | 32-bit layer mask (layers 1-32) | warning |
| `start_position` | Vector3(x, y, z) |  |
| `travel_cost` | float >= 0 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-navigationlink3d-positions` | `navigationlink3d-start-position-equals-end-position` | warning |
<!-- lint:end -->

Every property above is specific to NavigationLink3D, and `parser.ts` reuses
`parseNode3D`, which reads only `transform` and `visible` (`nodes/base/node3d/parser.ts`).
So the lenient parser never even LOOKS at `enabled`, `bidirectional`, `navigation_layers`,
`start_position`, `end_position`, `enter_cost` or `travel_cost` — a bad value on any of
them (a negative `enter_cost`, a non-boolean `enabled`) parses and renders identically to
a good one, because nothing downstream of the lenient parser ever reads the key at all.
Only the strict parser, through `linterParser.ts`, reports it.
