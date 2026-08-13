---
type: Marker3D
category: 3D
status: unreviewed
fixture: unit-marker-3d.tscn
image: unit-marker-3d
visual: false
renders_as: a selection-gated axis-cross gizmo
---

# Marker3D

A Node3D transform anchor that positions its children and draws a 3-axis editor
cross at its origin. That cross is selection-gated (ADR-0018), so a plain capture
shows nothing for it — and Godot's own editor gizmo does not render in the game,
so both images are just the empty preview sky and ground.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | position `(0, 1, 0)`, identity basis | anchors the marker one unit up; no visible geometry, and it has no children to place |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Marker3D -->
Strict parsing format-checks these `Marker3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `gizmo_extents` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

Strict rejects a non-numeric `gizmo_extents` as an error; the lenient parser
(`floatOr`) warns and falls back to Godot's own default, `0.25`. An absent
`gizmo_extents` gets the same `0.25` fallback silently, with no warning.
