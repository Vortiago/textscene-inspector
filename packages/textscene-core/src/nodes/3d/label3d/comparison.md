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

Glyph shapes differ — a Chromium fallback font on our side versus Godot's bundled default —
so letterforms, weight, and kerning vary across all four labels. This is inherent to
rasterising through the browser's font stack.

Text presence, colour, placement, per-label size, billboard orientation, and the black
outline on "Outlined Text" all match. The canvas texture is now premultiplied, so the
glyphs no longer carry a dark halo, and the outline is scaled to Godot's thinner
font-outline weight rather than a heavy centred stroke.

## Linting

<!-- lint:begin Label3D -->
Strict parsing format-checks these `Label3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `alpha_antialiasing_edge` | float 0-1 |
| `alpha_antialiasing_mode` | enum 0-2 (OFF/ALPHA_TO_COVERAGE/ALPHA_TO_COVERAGE_AND_TO_ONE) |
| `alpha_cut` | enum 0-3 (DISABLED/DISCARD/OPAQUE_PREPASS/HASH) |
| `alpha_hash_scale` | float 0-2 |
| `alpha_scissor_threshold` | float 0-1 |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) | BREAK_TRIM_START_EDGE_SPACES (64) | BREAK_TRIM_END_EDGE_SPACES (128) |
| `billboard` | enum 0-2 (DISABLED/ENABLED/FIXED_Y) |
| `double_sided` | true or false |
| `fixed_size` | true or false |
| `font` | SubResource("id") or ExtResource("id") |
| `font_size` | float > 0 |
| `horizontal_alignment` | enum 0-3 (LEFT/CENTER/RIGHT/FILL) |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) | JUSTIFICATION_WORD_BOUND (2) | JUSTIFICATION_AFTER_LAST_TAB (8) | JUSTIFICATION_SKIP_LAST_LINE (32) | JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) | JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |
| `language` | quoted string |
| `line_spacing` | float |
| `modulate` | Color(r, g, b, a) |
| `no_depth_test` | true or false |
| `offset` | Vector2(x, y) |
| `outline_modulate` | Color(r, g, b, a) |
| `outline_render_priority` | integer -128-127 |
| `outline_size` | float >= 0 |
| `pixel_size` | float |
| `render_priority` | integer -128-127 |
| `shaded` | true or false |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) |
| `structured_text_bidi_override_options` | Array literal ([...]) |
| `text` | quoted string |
| `text_direction` | enum -1-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) |
| `texture_filter` | enum 0-5 (NEAREST/LINEAR/NEAREST_WITH_MIPMAPS/LINEAR_WITH_MIPMAPS/NEAREST_WITH_MIPMAPS_ANISOTROPIC/LINEAR_WITH_MIPMAPS_ANISOTROPIC) |
| `uppercase` | true or false |
| `vertical_alignment` | enum 0-3 (TOP/CENTER/BOTTOM/FILL) |
| `width` | float |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-label3d-properties` | `label3d-small-pixel-size` | warning |
|  | `label3d-large-pixel-size` | warning |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

`pixel_size`, `outline_size`, `font_size`, and `line_spacing` fall back through `floatOr`, with a warning, to `0.005`, `12`, `32`, and `0`. `billboard` defaults to `DISABLED` when absent, but any present value other than `0` or `2`, including unparseable strings, silently resolves to `ENABLED` rather than the strict default, with no warning. `horizontal_alignment` warns and falls back to `CENTER` via `intOr` on an unparseable value, then silently re-clamps to `CENTER` a second time if the parsed int falls outside `0`-`3`. `no_depth_test` reads via plain string equality (`=== 'true'`) rather than `boolOr`, so anything but the literal "true" renders false with no warning. `modulate` and `outline_modulate` fall back to opaque white and opaque black on a malformed `Color`, silently, since `parseColor`/`colorOr` never warn.
