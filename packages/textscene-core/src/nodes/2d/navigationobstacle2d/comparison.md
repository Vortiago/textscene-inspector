---
type: NavigationObstacle2D
category: 2D
status: linter-only
fixture: unit-navigation-obstacle-2d.tscn
# image: unit-navigation-obstacle-2d
visual: false
renders_as: nothing (a transform-only group)
---

# NavigationObstacle2D

NavigationObstacle2D defines a 2D avoidance/navmesh-carving region. It has no
runtime visual — the previewer draws it as a transform-only Node2D group
(ADR-0008), so nothing appears; drawing nothing is correct here, not a gap.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `radius` | `50.0` | avoidance region radius — no runtime visual |
| `vertices` | `PackedVector2Array(0, 0, 100, 0, 100, 100, 0, 100)` | obstacle outline — no runtime visual |
| `affect_navigation_mesh` | `true` | discards source geometry inside the outline when baking — no runtime visual |
| `carve_navigation_mesh` | `true` | carving ignores baking offsets (e.g. agent radius) — no runtime visual |
| `avoidance_enabled` | `true` | enables avoidance for the region — no runtime visual |
| `velocity` | `Vector2(0, 0)` | predicted avoidance velocity, editor-hidden but still serialised — no runtime visual |
| `avoidance_layers` | `3` | avoidance layer bitmask — no runtime visual |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin NavigationObstacle2D -->
<!-- lint:end -->

The lenient parser registers `parseNode2D` directly (index.ts) rather than a
NavigationObstacle2D-specific parser, so `radius`, `vertices`,
`affect_navigation_mesh`, `carve_navigation_mesh`, `avoidance_enabled`,
`velocity` and `avoidance_layers` are never read into a typed field at all —
only Node2D's own transform/draw-order properties are. A malformed `radius`
(`"nope"`) or an out-of-range one (`radius = -1`, `radius = 9999`) therefore has
exactly the same (zero) effect on the rendered scene as a well-formed value:
nothing ever inspects it for rendering, so there is no fallback to describe.
The raw string still reaches `node.rawProperties` untouched, for any consumer
that reads it directly; only `StrictTscnParser`, via `linterParser.ts`, ever
validates it.
