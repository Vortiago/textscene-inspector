---
type: Label3D
category: 3D
fixture: unit-label3d.tscn
image: unit-label3d
renders_as: canvas-rasterised glyph quads, billboard-able
---

# Label3D

Label3D draws text on a billboard-able group in 3D space, through the shared shaping engine
(`r3f/controls/native/text/`) the native 2D Control `Label` uses — Godot's own default-theme
font rather than a host system font, so glyph shapes, kerning and line metrics are identical
on every host. Godot's default project font is not MSDF (`servers/text/text_server.cpp:2386`,
read by `scene/theme/theme_db.cpp:59`), so glyphs are rasterised through canvas-2D against
the bundled font's registered `FontFace` (`canvasTextPainter.ts`) rather than sampled from
the MSDF atlas the 2D Control text path uses; nothing paints until that registration
resolves, since an unregistered family would silently rasterise a host system font. The
glyph-drawing pass (`LabelGlyphs.tsx`) is `React.lazy`-loaded to keep the font bytes out of
the initial render bundle; the glyph meshes are tagged `tscnFrameExcluded`, so camera
auto-framing sees each label as its own origin point, matching what Godot's reference camera
sees. All four labels render by default.

The outline is its own surface, drawn before the fill — Godot's own model: two overlapping
`TRANSPARENCY_ALPHA` surfaces (`label_3d.cpp:386`) on one cached shader (`:396`), i.e.
`blend_mix, depth_draw_opaque` (`material.cpp:775-812`), ordered by
`material_set_render_priority` (`:402`) from `outline_render_priority` (`-1`) and
`render_priority` (`0`). Its width comes from FreeType's stroker: `_get_size_outline`
(`text_server_adv.h:406-414`) hands `outline_size` through unscaled and
`FT_Stroker_Set(stroker, (int)(fd->size.y * 16.0), …)` (`text_server_adv.cpp:1383`) reads it
as a 26.6 radius, so `outline_size` 12 is 3 px of one-sided reach — painted as a centred
canvas stroke of twice that, `LINEJOIN_ROUND`/`LINECAP_BUTT` as the stroker sets, and
`FT_Glyph_Stroke`'s both-borders export (`:1392`) is the transparent-interior annulus a
canvas stroke already draws.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Billboard Enabled"` … | the glyph string each label shows |
| `pixel_size` | `0.01` / `0.015` | world size per glyph pixel; the `0.015` "Outlined Text" reads larger |
| `billboard` | `1` / `0` / `2` | `1` faces the camera upright (yellow, white); `0` holds a fixed orientation, so the cyan label skews with the pitched camera and runs off-frame; `2` yaws around Y only, so the magenta label reads foreshortened |
| `modulate` | `Color(1,1,0,1)` … | tints the glyphs — yellow, cyan, magenta, white |
| `outline_size` | `8` | a 2 px one-sided FreeType stroke around "Outlined Text" |
| `outline_modulate` | `Color(0,0,0,1)` | the outline colour, black |

## Divergences

### Glyph-texture mipmaps

`texture_filter` (`label_3d.h:140`, default `LINEAR_WITH_MIPMAPS`) is read for its
nearest/linear bit only; the raster carries no mipmap chain, so a minified label samples the
base level rather than a filtered one. The raster is rebuilt whenever the text, size, tint or
outline changes, which is what makes a per-label chain the wrong thing to build.

### `alpha_cut` transparency modes

`alpha_cut` selects the surface's paint order model — only `ALPHA_CUT_DISABLED` sorts by
material render priority; every other mode bakes `priority * pixel_size` into vertex Z
instead (`label_3d.cpp:401-405,417-420`), which this renderer does. The mode's other half,
the transparency it selects (`:386-393`: `ALPHA_SCISSOR`, `ALPHA_DEPTH_PRE_PASS`,
`ALPHA_HASH`), is not implemented — every surface paints `TRANSPARENCY_ALPHA`.

### Unparsed properties

`vertical_alignment`, `autowrap_mode` and `width` are unparsed (see `types.ts`/`parser.ts`),
so every Label3D renders at Godot's own default for each:

- `vertical_alignment` defaults to `VERTICAL_ALIGNMENT_CENTER` (`label_3d.h`) — the origin
  sits at the vertical centre of the text block, which this renderer's centred placement
  (`glyphLayout.ts`'s `layoutLabel3DLines`) already matches without needing the property
  parsed.
- `HORIZONTAL_ALIGNMENT_FILL` folds into `CENTER` (`label_3d.cpp:592`'s switch falls `FILL`
  through to the `CENTER` case) rather than justifying — real Label3D justification lives
  in the `width`-driven `shaped_text_fit_to_width` block above the per-line loop, which
  this component does not call since `width` is unparsed.

## Linting

<!-- lint:begin Label3D -->
Strict parsing format-checks these `Label3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `alpha_cut` |
| `billboard` |
| `font_size` |
| `horizontal_alignment` |
| `line_spacing` |
| `modulate` |
| `no_depth_test` |
| `outline_modulate` |
| `outline_render_priority` |
| `outline_size` |
| `pixel_size` |
| `render_priority` |
| `text` |
| `texture_filter` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-label3d-properties` | `label3d-empty-text` | warning |
|  | `label3d-large-pixel-size` | warning |
<!-- lint:end -->

`pixel_size`, `outline_size`, `font_size`, and `line_spacing` fall back through `floatOr`, with a warning, to `0.005`, `12`, `32`, and `0`. `billboard` defaults to `DISABLED` when absent, but any present value other than `0` or `2`, including unparseable strings, silently resolves to `ENABLED` rather than the strict default, with no warning. `horizontal_alignment` warns and falls back to `CENTER` via `intOr` on an unparseable value, then silently re-clamps to `CENTER` a second time if the parsed int falls outside `0`-`3`. `no_depth_test` reads via plain string equality (`=== 'true'`) rather than `boolOr`, so anything but the literal "true" renders false with no warning. `modulate` and `outline_modulate` fall back to opaque white and opaque black on a malformed `Color`, silently, since `parseColor`/`colorOr` never warn. `alpha_cut` and `texture_filter` warn and fall back to `DISABLED` and `LINEAR_WITH_MIPMAPS` via `intOr`, then silently re-clamp to the same default if the parsed int falls outside the enum's range. `render_priority` and `outline_render_priority` warn and fall back to `0` and `-1`, unbounded in either direction as Godot's own signed priorities are.
