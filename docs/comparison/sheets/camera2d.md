---
type: Camera2D
category: 2D
fixture: unit-remote-transform-2d.tscn
image: unit-remote-transform-2d
renders_as: a 2D view frame with no drawn geometry
---

# Camera2D

Camera2D is a Node2D that defines the 2D view — which slice of the canvas the
viewport shows. The previewer draws no geometry for it; it only tags its group so
the Cameras panel can frame the view through it. The camera's outline is an
editor-only gizmo, drawn in neither capture. This fixture contains no Camera2D
node at all: what fills the frame is the fixture's two Polygon2D pentagons, the
blue one dragged up to the right by a RemoteTransform2D relay while the grey ghost
stays at the authored spot. Nothing on screen exercises Camera2D.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| — | — | the fixture defines no Camera2D node, so no Camera2D property is set or exercised |

## Divergences

The two frames place both pentagons identically; one difference is visible, in the
blue fill rather than the layout:

- **The blue pentagon reads paler and less saturated in ours.** Godot writes the
  authored 2D colour straight to the framebuffer (`0.2, 0.7, 0.9` → `51, 178, 229`);
  ours renders it lifted toward a washed cyan (`95, 191, 217`). With no
  `WorldEnvironment` in the scene the previewer mounts Godot's editor preview
  environment (ADR-0025), whose FILMIC tonemapping is set on the whole canvas — the
  unlit 2D polygons included — whereas Godot tonemaps only the 3D pass, never the 2D
  canvas.
