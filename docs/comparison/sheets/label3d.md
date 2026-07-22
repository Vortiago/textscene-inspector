---
type: Label3D
category: 3D
fixture: unit-label3d.tscn
image: unit-label3d
renders_as: a canvas-textured plane
---

# Label3D

Label3D draws a single line of text on a flat plane in 3D space. The previewer rasterises
each label to a canvas texture, maps it onto a transparent `PlaneGeometry` sized by
`pixel_size`, tints it by `modulate`, and orients it per the node's `billboard` mode. All
four labels render by default.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Billboard Enabled"` … | the glyph string each label shows |
| `pixel_size` | `0.01` / `0.015` | world size per glyph pixel; the `0.015` "Outlined Text" reads larger |
| `billboard` | `1` / `0` / `2` | `1` faces the camera upright (yellow, white); `0` holds a fixed orientation, so the cyan label skews with the pitched camera and runs off-frame; `2` yaws around Y only, so the magenta label reads foreshortened |
| `modulate` | `Color(1,1,0,1)` … | tints the glyphs — yellow, cyan, magenta, white |
| `outline_size` | `8` | black outline width around "Outlined Text" |
| `outline_modulate` | `Color(0,0,0,1)` | the outline colour, black |

## Divergences

Our labels carry a dark, boxy fringe hugging each glyph run: the transparent canvas
backing is not fully keyed out, so a black halo shows around and behind the text. Godot's
label planes are cleanly transparent, drawing only the tinted glyphs. It is most obvious
on the yellow, cyan, and magenta labels.

Glyph shapes also differ — a Chromium fallback font on our side versus Godot's bundled
default — so letterforms, weight, and kerning vary across all four labels. This is
inherent to rasterising through the browser's font stack.

Text presence, colour, placement, per-label size, billboard orientation, and the black
outline on "Outlined Text" all match.
