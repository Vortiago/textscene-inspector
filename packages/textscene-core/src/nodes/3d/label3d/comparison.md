---
type: Label3D
category: 3D
status: limitation
fixture: unit-label3d.tscn
image: unit-label3d
renders_as: canvas-rasterised glyph quads, billboard-able
---

# Label3D

Draws text on a flat plane in 3D space. The previewer shapes it in its `text_direction`, `language` and structured override, where an empty `language` takes the project locale and INHERITED acts as AUTO (`label_3d.cpp:479-494`). It breaks it at `width` as `autowrap_mode` says. It stretches each line to `width` under `HORIZONTAL_ALIGNMENT_FILL`, places the block by `vertical_alignment` and moves it by `offset` (`label_3d.cpp:483-606`). It rasterises a label in an outline font to a canvas texture, one texel per font pixel at `font_size` as Godot caches a glyph (`label_3d.cpp:345-350`). The font is the label's `font`, else the project theme's font for Label3D, else the project default font (`gui/theme/custom_font`), else the bundled font (`label_3d.cpp:812-850`). It maps the texture onto a transparent plane sized by `pixel_size`. It tints the plane by `modulate` and orients it by the node's `billboard` mode.

A character the font lacks draws from the first font of its **Fallback chain** that has it. The `label3d-text-mesh-font-fallbacks` golden pins this. A character no font of the chain has draws nothing, as a glyph with no font has no rectangle to draw (`label_3d.cpp:357`). Godot draws no hex-code box for it, and the pen still advances.

A precomposed character the font lacks draws as its base and marks in that font (`hb-ot-shape-normalize.cc`). The marks sit at the offsets of its `GPOS` mark lookups. In a font with no `GPOS` script they sit against the ink of the base (`hb-ot-shape-fallback.cc`). The `label3d-text-mesh-decomposed-marks` golden pins this. A base and a combining mark typed as two characters join into the composite the font has, else the mark sits at the same offsets.

A label is unlit by default. With `shaded` on, the scene's lights light its fill and outline, as Godot's `SHADING_MODE_PER_PIXEL` does (`material.cpp:3045`), and the label receives shadows. The plane faces +Z (`label_3d.cpp:422-423`). A double-sided label flips the normal of its back face (`scene_forward_clustered.glsl:1263-1266`), so its back is lit as its front. The `label3d-shaded` golden pins this.

The outline is surface 0 of the label and the fill is surface 1 (`label_3d.cpp:610-615`). Each sorts in the alpha pass by its render priority. At one priority Godot draws the later surface first (`render_forward_clustered.cpp:4147-4148`), so the outline draws over the fill. The `label3d-outline-priority` golden pins this.

A label casts no shadow by default, as its constructor turns `cast_shadow` off (`label_3d.cpp:1090`). With it on, the glyphs cast when Godot files their surface in the shadow pass (`render_forward_clustered.cpp:4079-4089`). That pass takes a cut surface, or an `OPAQUE_PREPASS` one, with the depth test on. An `OPAQUE_PREPASS` surface blends uncut, writes its depth in a depth prepass cut at 0.99, and cuts its shadow at 0.1 (`render_forward_clustered.cpp:1791,2770`). A blended label, the default `alpha_cut`, casts nothing. The `label3d-shadow` golden pins this.

## BMFont

A label in a BMFont draws each glyph as a quad over its page image at `pixel_size` (`label_3d.cpp:345-350`). The quad takes the glyph's offset and size. The label skips a glyph whose page rectangle is 2 px or less in either direction, and a character the font lacks (`:357-360`). The pen still advances past it. Its material decodes the page and the modulate and multiplies them in linear (`material.cpp:969,1218`). Any `outline_size` above 0 draws the font's outline set (`text_server_adv.h:406-414`). The `label3d-bmfont` golden pins this.

## Variable fonts

A `FontVariation` over a variable font draws the instance that its `variation_opentype` names, as Godot sets
the axes on FreeType and HarfBuzz (`text_server_adv.cpp:1915-1950`). The glyphs and the outline draw from the outlines
at the instance. They follow the `fvar`, `avar`, `gvar` and `cvar` tables. Each advance follows `HVAR`, or the
phantom points that `gvar` moves in a font without `HVAR`. The pair kerning follows the `GPOS` `kern` feature
with its deltas at the instance. The `rvrn` feature of the `GSUB` `FeatureVariations` swaps glyphs at some axis values. A `FontVariation` over another takes its own axis values alone (`font.cpp:3120-3131`).

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
| `font` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `font_size` | integer >= 1 | warning below |
| `horizontal_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) \| JUSTIFICATION_WORD_BOUND (2) \| JUSTIFICATION_AFTER_LAST_TAB (8) \| JUSTIFICATION_SKIP_LAST_LINE (32) \| JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) \| JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |  |
| `language` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `line_spacing` | float |  |
| `modulate` | Color(r, g, b, a), or the colour string or int it converts |  |
| `no_depth_test` | true or false |  |
| `offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `outline_modulate` | Color(r, g, b, a), or the colour string or int it converts |  |
| `outline_render_priority` | integer -128-127 | error |
| `outline_size` | integer 0-127 | warning |
| `pixel_size` | float 0.0001-128 | warning |
| `render_priority` | integer -128-127 | error |
| `shaded` | true or false |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...] or Array[T]([...])) |  |
| `text` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
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

`pixel_size`, `outline_size`, `font_size`, `line_spacing` and `alpha_antialiasing_edge` warn and fall back through `floatOr` to `0.005`, `12`, `32`, `0` and `0`. `alpha_antialiasing_mode` warns and falls back to `OFF`. A malformed `transparency` keeps Godot's default (`0`) silently, which draws the label opaque. A `billboard` outside `0` to `2` keeps `DISABLED`, as Godot's setter refuses it. `no_depth_test` reads every spelling a BOOL slot converts, so `1` is true. Text no BOOL slot reads renders false without a warning. `modulate` and `outline_modulate` fall back silently to opaque white and opaque black on a malformed `Color`.

The glyph raster has a mip chain only when its font generates mipmaps and `texture_filter` is mipmapped. The bundled font generates them when `gui/theme/default_font_generate_mipmaps` is on (`text_server.cpp:2387`, `text_server_adv.cpp:3121`). Any other font keeps its own `generate_mipmaps` (`default_theme.cpp:1359-1386`). The project's `texture_mipmap_bias` then offsets the chain.

## Known limitations

- **Approximated** A `material_override` or a `material_overlay` fills one quad for each line of an outline font, where Godot fills one quad for each glyph.
- **Approximated** The glyph mip chain is per label raster, where Godot's is per glyph page, so a minified label differs slightly.
- **Resource gap** A SystemFont always draws the default font, as Godot does when no OS font matches its names, where Godot draws a matching OS font.
- **Approximated** A glyph off whole pixels draws at its place, where Godot's mesh samples its glyph texture between texels.
- **Approximated** Under msaa_3d Disabled, alpha to coverage cuts the edge at alpha 0.5, where Godot's driver picks its own one-sample mask.
- **Approximated** Under msaa_3d, `ALPHA_TO_COVERAGE_AND_TO_ONE` stores the ramped alpha where Godot stores 1, so a transparent background shows the edge fainter.
- **Approximated** A line with a hex-code box keeps the ascent of a BMFont, where Godot grows it to fit the box (#1324).
- **Approximated** `ALPHA_HASH` keeps about Godot's share of pixels but not the same pixels, as the ported hash's `fract(1e4 * sin())` rounds differently on each GPU (`scene_forward_aa_inc.glsl:3-39`).
