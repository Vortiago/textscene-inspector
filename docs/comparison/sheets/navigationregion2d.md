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
