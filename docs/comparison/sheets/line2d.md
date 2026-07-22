---
type: Line2D
category: 2D
fixture: unit-line2d.tscn
image: unit-line2d
renders_as: a stroked mesh polyline
---

# Line2D

Line2D strokes a chain of points at a fixed width; the previewer draws it as flat
mesh quads, one per segment, with sharp joint wedges filling the interior corners.
The fixture places two: a white diagonal bar and a closed blue-purple triangle.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `points` | 2-point / 3-point arrays | the diagonal bar and the triangle's three edges |
| `width` | `16` / `8` | stroke thickness of each line |
| `default_color` | white / `(0.5, 0.5, 1)` | the bar is white, the triangle blue-purple |
| `closed` | `true` (triangle) | wraps the third point back to the first, closing the outline |
| `position` | `(100,100)` / `(350,100)` | places the two lines side by side |

## Divergences

Position, width, cap shape, and closed-outline corners match Godot to within a
pixel, but the colors are dimmer and shifted. Godot draws the 2D canvas colors
straight in sRGB — pure white `(255,255,255)` and blue-purple `(128,128,255)`.
Ours renders white as light grey `(226,226,226)` and the blue-purple as a lighter,
slightly desaturated `(149,143,226)`: the Line2D meshes pass through the scene's
editor-preview tonemapping ([ADR-0025], injected by the reference harness), which
compresses the white highlight and desaturates the fill, whereas Godot's 2D canvas
pipeline is not tonemapped.

[ADR-0025]: ../../adr/0025-preview-lighting-mirrors-the-godot-editor.md
