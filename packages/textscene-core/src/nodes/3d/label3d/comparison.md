---
type: Label3D
category: 3D
fixture: unit-label3d.tscn
image: unit-label3d
renders_as: MSDF glyph-quad geometry, billboard-able
---

# Label3D

Label3D draws text on a billboard-able group in 3D space, through the same vendored MSDF
Open Sans atlas and shaping engine (`r3f/controls/native/text/`) the native 2D Control
`Label` uses — Godot's own default-theme font rather than a host system font, so glyph
shapes, kerning and line metrics are identical on every host. The glyph-drawing pass
(`LabelGlyphs.tsx`) is `React.lazy`-loaded to keep the atlas out of the initial render
bundle; the glyph mesh is tagged `tscnFrameExcluded`, so camera auto-framing sees each
label as its own origin point, matching what Godot's reference camera sees. All four
labels render by default.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Billboard Enabled"` … | the glyph string each label shows |
| `pixel_size` | `0.01` / `0.015` | world size per glyph pixel; the `0.015` "Outlined Text" reads larger |
| `billboard` | `1` / `0` / `2` | `1` faces the camera upright (yellow, white); `0` holds a fixed orientation, so the cyan label skews with the pitched camera and runs off-frame; `2` yaws around Y only, so the magenta label reads foreshortened |
| `modulate` | `Color(1,1,0,1)` … | tints the glyphs — yellow, cyan, magenta, white |
| `outline_size` | `8` | outline dilation around "Outlined Text" (see "Outline" below) |
| `outline_modulate` | `Color(0,0,0,1)` | the outline colour, black |

## Divergences

### Outline — thinner than Godot for large `outline_size`

Godot's outline is a SEPARATE FreeType-stroked glyph bitmap
(`label_3d.cpp:332-450`'s `_generate_glyph_surfaces`, keyed by
`Vector2i(font_size, outline_size)`) — a real geometric dilation of the glyph outline, not
a shader effect. This renderer instead decodes a SECOND, more-dilated threshold of the SAME
MSDF distance field in the SAME draw call as the fill (`msdfMaterial.ts`'s
`uOutlineBias`/`uOutlineColor`/`uOutlineOpacity`; `nodes/3d/label3d/glyphLayout.ts`'s
`outlineDistanceBias`).

Both thresholds decode in ONE shader invocation, so a fragment carries a single alpha
value regardless of on-screen size; and `outlineDampen` ramps the outline contribution
from zero at `screenPxRange()`'s minification floor to full strength by `spr == 2`, so a
shrinking caption loses its outline gracefully rather than blooming into a block (at the
floor, a fully-"outside" texel's `sigDist` sits only `0.5` from the alpha=0 threshold, and
a positive bias would otherwise haze the whole quad).

The approximation is width only: the vendored atlas's own
per-glyph padding bounds how far a `distanceBias` shift can dilate before the outline
visibly SQUARES OFF (reads as the glyph's own bounding rectangle rather than a rounded
band) — measured directly against `unit-box-mesh.tscn`'s "BoxMesh Test" caption
(`font_size` 32, `pixel_size` 0.008, default `outline_size` 12): `MAX_DISTANCE_BIAS = 0.3`
is the largest value that keeps every letter's outline rounded rather than square. That
caps the achievable dilation below Godot's own for `outline_size` above roughly 4 (at
`font_size` 32); a Label3D with a large `outline_size` renders a thinner outline than
Godot, not the full weight — an accepted trade for reusing the shared MSDF pipeline with
zero new atlas bytes.

The calibration constant (`OUTLINE_DILATION_PX_PER_UNIT = 0.27` Godot px of one-sided
dilation per unit of `outline_size`) is measured against real Godot 4.6.3, not derived: a
single-glyph scratch scene (`text="H"`, `outline_size=32`,
`outline_modulate=black`, camera `(0,0,3)` looking at the origin, `pixel_size=0.01`)
rendered at `font_size=128` AND again at `font_size=64` both measured a one-sided outline
band of ≈13.4 screen px around the H's stems (half-max crossings of the
background/outline and outline/ink transitions in `pnpm ref:godot`'s own pixels) —
confirming the dilation is independent of `font_size`, exactly as `outline_size` being its
own absolute font-pixel quantity predicts. The screen-px measurement converted to Godot px
via the SAME glyph's own known atlas bounding-box width as a ruler (`H` = 28 atlas-bake px,
scale `fontSizePx/42`), rather than deriving the camera's world-to-screen scale, which
`--frame`/`--camera` do not print.

### Unparsed properties

`vertical_alignment`, `autowrap_mode`, `width`, `render_priority`, and
`outline_render_priority` are unparsed (see `types.ts`/`parser.ts`), so every Label3D
renders at Godot's own default for each:

- `vertical_alignment` defaults to `VERTICAL_ALIGNMENT_CENTER` (`label_3d.h`) — the origin
  sits at the vertical centre of the text block, which this renderer's centred placement
  (`glyphLayout.ts`'s `layoutLabel3DLines`) already matches without needing the property
  parsed.
- `outline_render_priority` (`label_3d.h` default `-1`) sorting behind `render_priority`
  (default `0`) is now expressed as a rendering DEFAULT anyway: `LabelGlyphs.tsx` decodes
  the outline in the SAME draw call as the fill (see above), so there is no second surface
  whose relative order could regress even though the properties themselves are unparsed.
- `HORIZONTAL_ALIGNMENT_FILL` folds into `CENTER` (`label_3d.cpp:592`'s switch falls `FILL`
  through to the `CENTER` case) rather than justifying — real Label3D justification lives
  in the `width`-driven `shaped_text_fit_to_width` block above the per-line loop, which
  this component does not call since `width` is unparsed.

## Linting

<!-- lint:begin Label3D -->
Strict parsing format-checks these `Label3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `billboard` |
| `font_size` |
| `horizontal_alignment` |
| `line_spacing` |
| `modulate` |
| `no_depth_test` |
| `outline_modulate` |
| `outline_size` |
| `pixel_size` |
| `text` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-label3d-properties` | `label3d-empty-text` | warning |
|  | `label3d-large-pixel-size` | warning |
<!-- lint:end -->

`pixel_size`, `outline_size`, `font_size`, and `line_spacing` fall back through `floatOr`, with a warning, to `0.005`, `12`, `32`, and `0`. `billboard` defaults to `DISABLED` when absent, but any present value other than `0` or `2`, including unparseable strings, silently resolves to `ENABLED` rather than the strict default, with no warning. `horizontal_alignment` warns and falls back to `CENTER` via `intOr` on an unparseable value, then silently re-clamps to `CENTER` a second time if the parsed int falls outside `0`-`3`. `no_depth_test` reads via plain string equality (`=== 'true'`) rather than `boolOr`, so anything but the literal "true" renders false with no warning. `modulate` and `outline_modulate` fall back to opaque white and opaque black on a malformed `Color`, silently, since `parseColor`/`colorOr` never warn.
