---
type: NavigationRegion3D
category: 3D
status: unreviewed
fixture: unit-navigation-region-3d.tscn
image: unit-navigation-region-3d
visual: false
renders_as: a translucent green navmesh overlay
---

# NavigationRegion3D

NavigationRegion3D holds a NavigationMesh describing walkable area. That mesh has
no game-runtime visual in Godot — it is navigation data, drawn only by the
editor's "Visible Navigation" overlay. This previewer surfaces that overlay by
default, drawing the mesh as translucent green faces with edge lines.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `navigation_mesh` | `NavigationMesh` (a 4×4 ground quad, two triangles) | drawn as the translucent green overlay, split by the diagonal edge line |

## Divergences

Godot's render shows only the empty preview environment — the navmesh is absent,
because the reference render is the game view and does not inject the editor's
"Visible Navigation" debug draw. Ours deliberately draws that overlay (a
translucent green filled mesh with edge lines, the diagonal splitting it into the
two authored triangles), so the quad is visible in our image and blank in Godot's.
This is the useful thing a previewer can show, not a defect to fix.

## Linting

<!-- lint:begin NavigationRegion3D -->
Strict parsing format-checks these `NavigationRegion3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `enabled` | true or false |  |
| `enter_cost` | float >= 0 | error below |
| `navigation_layers` | 32-bit layer mask (layers 1-32) | warning |
| `navigation_mesh` | null, SubResource("id") or ExtResource("id") |  |
| `travel_cost` | float >= 0 | error below |
| `use_edge_connections` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-navigationregion3d-resources` | `valid-navigationregion3d-resources` | error |
|  | `navigationregion3d-requires-navigation-mesh` | warning |
<!-- lint:end -->

`navigation_mesh` is assigned straight from the raw property string, with no
format check at all: strict's resource-reference validator rejects a
malformed reference as an error, but the lenient parser stores whatever text
is present, or leaves the property `undefined` if absent, and lets any
downstream resource lookup fail on its own rather than catching it here.
