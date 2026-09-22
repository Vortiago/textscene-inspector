---
type: Label3D
category: 3D
status: limitation
fixture: unit-label3d.tscn
image: unit-label3d
renders_as: canvas-rasterised glyph quads, billboard-able
---

# Label3D

Draws a single line of text on a flat plane in 3D space. The previewer rasterises each label to a canvas texture, maps it onto a transparent plane sized by `pixel_size`, tints it by `modulate` and orients it by the node's `billboard` mode.

## Linting

<!-- lint:begin Label3D -->
Strict parsing format-checks these `Label3D` properties, plus 18 inherited from GeometryInstance3D, 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alpha_antialiasing_edge` | float 0-1 | warning |
| `alpha_antialiasing_mode` | enum 0-2 (OFF/ALPHA_TO_COVERAGE/ALPHA_TO_COVERAGE_AND_TO_ONE) | warning |
| `alpha_cut` | enum 0-3 (DISABLED/DISCARD/OPAQUE_PREPASS/HASH) | error |
| `alpha_hash_scale` | float 0-2 | warning |
| `alpha_scissor_threshold` | float 0-1 | warning |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) | warning |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) \| BREAK_TRIM_START_EDGE_SPACES (64) \| BREAK_TRIM_END_EDGE_SPACES (128) |  |
| `billboard` | enum 0-2 (DISABLED/ENABLED/FIXED_Y) | error |
| `double_sided` | true or false |  |
| `fixed_size` | true or false |  |
| `font` | null, SubResource("id") or ExtResource("id") |  |
| `font_size` | integer >= 1 | warning below |
| `horizontal_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) \| JUSTIFICATION_WORD_BOUND (2) \| JUSTIFICATION_AFTER_LAST_TAB (8) \| JUSTIFICATION_SKIP_LAST_LINE (32) \| JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) \| JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |  |
| `language` | quoted string, or the &"…" StringName jacket |  |
| `line_spacing` | float |  |
| `modulate` | Color(r, g, b, a) |  |
| `no_depth_test` | true or false |  |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `outline_modulate` | Color(r, g, b, a) |  |
| `outline_render_priority` | integer -128-127 | error |
| `outline_size` | integer 0-127 | warning |
| `pixel_size` | float 0.0001-128 | warning |
| `render_priority` | integer -128-127 | error |
| `shaded` | true or false |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...]) |  |
| `text` | quoted string, or the &"…" StringName jacket |  |
| `text_direction` | enum 0-2 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL) | error below -1, warning below 0, warning above 2, error above 3 |
| `texture_filter` | enum 0-5 (NEAREST/LINEAR/NEAREST_WITH_MIPMAPS/LINEAR_WITH_MIPMAPS/NEAREST_WITH_MIPMAPS_ANISOTROPIC/LINEAR_WITH_MIPMAPS_ANISOTROPIC) | warning |
| `uppercase` | true or false |  |
| `vertical_alignment` | enum 0-2 (VERTICAL_ALIGNMENT_TOP/VERTICAL_ALIGNMENT_CENTER/VERTICAL_ALIGNMENT_BOTTOM) | error below 0, warning above 2, error above 3 |
| `width` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-geometryinstance3d-visibility-range` (type-family match) | `geometryinstance3d-visibility-range-end-before-begin` | warning |
|  | `geometryinstance3d-visibility-range-begin-fade-without-margin` | warning |
|  | `geometryinstance3d-visibility-range-end-fade-without-margin` | warning |
<!-- lint:end -->

`pixel_size`, `outline_size`, `font_size` and `line_spacing` warn and fall back through `floatOr` to `0.005`, `12`, `32` and `0`. A present `billboard` other than `0` or `2` silently resolves to `ENABLED`. `no_depth_test` is a raw `=== 'true'` comparison, so any other value renders false without a warning. `modulate` and `outline_modulate` fall back silently to opaque white and opaque black on a malformed `Color`.

## Known limitations

- **Approximated** The outline is a dilated fill rather than a stroked contour, so it
  reads softer than Godot's.
- **Approximated** `width` and `autowrap_mode` are not read, so a long label runs on one
  line where Godot would wrap it.
- **Approximated** The glyph texture carries no mipmaps, so a label seen small sparkles
  where Godot's stays smooth.
- **Approximated** `alpha_cut = OPAQUE_PREPASS` clips against a fixed threshold in the
  colour pass too, where Godot clips only depth, so glyph edges are harder.
- **Approximated** `alpha_hash_scale`, `alpha_antialiasing_mode` and
  `alpha_antialiasing_edge` have no counterpart, so a hashed-alpha label's dither grain
  differs and its edges are not feathered.
