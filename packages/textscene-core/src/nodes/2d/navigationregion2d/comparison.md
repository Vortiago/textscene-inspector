---
type: NavigationRegion2D
category: 2D
fixture: unit-navigation-region-2d.tscn
image: unit-navigation-region-2d
visual: false
renders_as: a translucent green navigation-mesh overlay
---

# NavigationRegion2D

A 2D region whose `NavigationPolygon` defines walkable area. The previewer draws
that polygon as a translucent green fill plus edge lines — the editor's
navigation visualization — gated on the `showNavigation` viewport toggle, on by
default.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `navigation_polygon` | `ExtResource("1_poly")` | the 128×128 polygon our previewer fills as a green overlay in the top-left |

## Divergences

Godot's frame is empty grey; ours shows a translucent green 128×128 square at the
origin. Navigation-mesh visualization is an editor/debug overlay — Godot's game
reference render draws none of it, while our `showNavigation` toggle defaults on
and paints the polygon fill and edges. Turning the toggle off matches Godot.

## Linting

<!-- lint:begin NavigationRegion2D -->
Strict parsing format-checks these `NavigationRegion2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `navigation_polygon` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-navigationregion2d-resources` | `valid-navigationregion2d-resources` | error |
|  | `navigationregion2d-requires-navigation-polygon` | warning |
<!-- lint:end -->

`navigation_polygon` has no fallback of its own: the parser passes the raw
resource-reference string straight through when present and leaves the
property `undefined` when absent, so an invalid or dangling reference isn't
caught here, it simply renders no navigation mesh.
