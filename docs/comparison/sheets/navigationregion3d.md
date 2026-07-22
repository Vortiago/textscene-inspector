---
type: NavigationRegion3D
category: 3D
fixture: unit-navigation-region-3d.tscn
image: unit-navigation-region-3d
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
