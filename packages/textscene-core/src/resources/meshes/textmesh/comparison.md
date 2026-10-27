---
type: TextMesh
category: Resources
status: limitation
fixture: unit-text-mesh.tscn
image: unit-text-mesh
renders_as: one THREE.BufferGeometry of the glyph outlines, with front, back and side faces
---

# TextMesh

A PrimitiveMesh that builds a flat or deep surface from the outlines of a font's glyphs. The previewer reads the outlines from a TrueType or OpenType-CFF scene font and tessellates them as Godot does. The 2D text controls and this mesh lay out lines with one shaper. A MeshInstance3D, a GridMap cell and a CSGMesh3D show their loading state until the font file and its metrics arrive, then draw the text.

## Linting

<!-- lint:begin TextMesh -->
Strict parsing format-checks these `TextMesh` properties, plus 5 inherited from PrimitiveMesh, 1 inherited from Mesh, 2 inherited from Resource. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) | warning |
| `curve_step` | float 0.1-10 | error |
| `depth` | float >= 0 | error below |
| `font` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `font_size` | integer 1-127 | error below 1, error above 127 |
| `horizontal_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) \| JUSTIFICATION_WORD_BOUND (2) \| JUSTIFICATION_AFTER_LAST_TAB (8) \| JUSTIFICATION_SKIP_LAST_LINE (32) \| JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) \| JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |  |
| `language` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `line_spacing` | float |  |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `pixel_size` | float 0.0001-128 | error |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...] or Array[T]([...])) |  |
| `text` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `text_direction` | enum 0-2 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL) | error below -1, warning below 0, warning above 2, error above 3 |
| `uppercase` | true or false |  |
| `vertical_alignment` | enum 0-2 (VERTICAL_ALIGNMENT_TOP/VERTICAL_ALIGNMENT_CENTER/VERTICAL_ALIGNMENT_BOTTOM) | error below 0, warning above 2, error above 3 |
| `width` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser clamps `font_size` to 1-127, `pixel_size` to 0.0001-128 and `curve_step` to 0.1-10, and raises a negative `depth` to 0, as Godot's setters do. An alignment past its last value keeps the default.

## Known limitations

- **Approximated** Godot hints a TrueType outline vertically, so a glyph's height and y position differ from the unhinted outline by a fraction of a pixel.
- **Resource gap** A TextMesh with no font, or a font the previewer cannot read (WOFF, WOFF2 or SystemFont), draws a wireframe box, and the node's details name the type.
- **Approximated** A character the font lacks draws as a hex-code box, where Godot first tries the font's fallbacks and the system fonts.
- **Approximated** A FontVariation's embolden and skew change the advance of each glyph and leave its outline as it is.
- **Approximated** Text direction, language and the structured text override are ignored, so right-to-left text and ligatures draw in logical order.
