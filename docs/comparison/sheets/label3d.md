---
type: Label3D
category: 3D
fixture: unit-label3d.tscn
image: unit-label3d
renders_as: a canvas-textured plane
---

# Label3D

Label3D draws a line of text on a flat plane in 3D space. The previewer rasterises the
text to a canvas and maps it onto a transparent `PlaneGeometry` sized by `pixel_size`,
billboarded per the node's mode. In-viewport label text is gated behind the Labels
toggle, **off by default** (ADR-0008), so it is absent from a plain capture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | e.g. `"Billboard Enabled"` | the glyph string each label shows |
| `pixel_size` | `0.01` / `0.015` | world size per glyph pixel; the `0.015` "Outlined Text" reads larger |
| `billboard` | `0` / `1` / `2` | `1` faces the camera upright; `0` keeps a fixed orientation (the cyan label skews with the pitched camera); `2` yaws around Y only (the magenta label reads foreshortened) |
| `modulate` | `Color(1,1,0,1)` … | tints the glyphs — yellow, cyan, magenta, white |
| `outline_size` | `8` | black outline width around "Outlined Text" |
| `outline_modulate` | `Color(0,0,0,1)` | the outline colour |

## Divergences

The Godot reference renders all four labels (yellow "Billboard Enabled", cyan
fixed-orientation "Billboard Disabled" tilting off-frame, magenta Y-axis "Y-Axis
Billboard", and white "Outlined Text" with its black outline). Our capture is blank:
in-viewport Label3D text is toggle-gated behind the Labels flag, off by default
(ADR-0008), so a plain capture draws none of it. This is a UI default, not a rendering
gap — with Labels on, the same canvas-textured planes draw.
