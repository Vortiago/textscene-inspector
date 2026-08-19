---
type: NavigationLink2D
category: 2D
status: linter-only
fixture: unit-navigation-link-2d.tscn
# image: unit-navigation-link-2d
visual: false
renders_as: nothing (a transform-only group)
---

# NavigationLink2D

NavigationLink2D describes a navigation-mesh shortcut between two points (a zipline, a teleporter, a jump gap) for the navigation server to route agents through; it draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and that absence is correct, not a gap.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `enabled` | `true` | link is active — no runtime visual |
| `bidirectional` | `false` | link is one-way, start → end — no runtime visual |
| `navigation_layers` | `3` | layer bitmask the link belongs to — no runtime visual |
| `start_position` | `Vector2(0, 0)` | link's local start point — no runtime visual |
| `end_position` | `Vector2(100, 50)` | link's local end point — no runtime visual |
| `enter_cost` | `0.5` | added to path distance on entering the link — no runtime visual |
| `travel_cost` | `2.0` | multiplies traveled distance along the link — no runtime visual |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin NavigationLink2D -->
Strict parsing format-checks these `NavigationLink2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `bidirectional` | true or false |  |
| `enabled` | true or false |  |
| `end_location` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `end_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `enter_cost` | float >= 0 | error below |
| `navigation_layers` | 32-bit layer mask (layers 1-32) |  |
| `start_location` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `start_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `travel_cost` | float >= 0 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-navigationlink2d-endpoints` | `navigationlink2d-coincident-endpoints` | warning |
<!-- lint:end -->

None of NavigationLink2D's own seven properties feed the lenient parser at all:
`parser.ts` reuses `parseNode2D` verbatim, which only reads Node2D's transform
surface (`position`/`rotation`/`scale`/`skew`/…) and has no branch for
`enabled`, `bidirectional`, `navigation_layers`, `start_position`,
`end_position`, `enter_cost`, or `travel_cost`. So a malformed value on any of
them — `enter_cost = banana`, `navigation_layers = nonsense` — produces no
lenient-parser warning and no substitution; the key is simply never read,
where a bad Node2D property instead warns and falls back to a documented
default. The strict parser still catches it, because `StrictTscnParser` scans
every `key = value` line by text and checks `validatorRegistry` independently
of whether `parser.ts` ever looks at that key.
