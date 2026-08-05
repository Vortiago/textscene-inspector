---
type: Label3D
category: 3D
fixture: unit-label3d.tscn
image: unit-label3d
renders_as: MSDF glyph-quad geometry, billboard-able
---

# Label3D

Label3D draws text on a billboard-able group in 3D space, through the SAME vendored MSDF
Open Sans atlas and shaping engine (`r3f/controls/native/text/`) the native 2D Control
`Label` uses — Godot's actual default-theme font, not a host system font, rasterised via
`shapeText` + `TextRun` exactly as the Control does, so the two can no longer drift on a
host whose font-substitution chain differs from whoever captured a golden. The
glyph-drawing pass (`LabelGlyphs.tsx`) is `React.lazy`-loaded so the ~300KB atlas stays out
of the initial render bundle; a synchronous, invisible bounds-proxy mesh (`Component.tsx`)
keeps camera auto-framing correct before that lazy chunk resolves (see "Auto-framing"
below). All four labels render by default.

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

### Glyph shapes — CLOSED

The previous canvas-rasteriser divergence ("Glyph shapes differ — a Chromium fallback font
on our side versus Godot's bundled default") no longer applies: Label3D now shapes and
draws through the SAME vendored `OpenSans_SemiBold` MSDF atlas the native Control `Label`
uses, so glyph shapes, kerning, and line metrics are the SAME data on every host,
independent of what fonts happen to be installed. `example-hallway-mockup.tscn`'s
11-Label3D golden — which the previous divergence entry singled out as carrying "every
edge-antialiasing byte of drift" for that scene — is measurably CLOSER to real Godot now
(see "Arbitration" below), not just differently wrong.

### Outline — approximated, measurably thinner than Godot for large `outline_size`

Godot's outline is a SEPARATE FreeType-stroked glyph bitmap
(`label_3d.cpp:332-450`'s `_generate_glyph_surfaces`, keyed by
`Vector2i(font_size, outline_size)`) — a real geometric dilation of the glyph outline, not
a shader effect. This renderer instead decodes a SECOND, more-dilated threshold of the SAME
MSDF distance field in the SAME draw call as the fill (`msdfMaterial.ts`'s
`uOutlineBias`/`uOutlineColor`/`uOutlineOpacity`; `nodes/3d/label3d/glyphLayout.ts`'s
`outlineDistanceBias`).

Two failure modes were found and fixed while building this, both against real renders (not
derived):

1. **Two-mesh compositing darkened every anti-aliased edge.** An earlier version drew the
   outline as a SEPARATE mesh behind the fill (mirroring Godot's own two-surface
   structure). Compositing two independently alpha-blended layers of a near-identical
   shape over-darkens every partial-coverage fragment — invisible at large on-screen size
   (few edge fragments relative to solid interior) but covering nearly the WHOLE glyph at
   a small on-screen caption (most of its fragments ARE edge fragments), rendering a solid
   blob instead of a thin outline. Fixed by decoding both thresholds in ONE shader
   invocation (`msdfMaterial.ts`), so there is only one alpha value per fragment to composite,
   regardless of on-screen size.
2. **`screenPxRange()`'s own minification floor** (unrelated to the above): once a glyph is
   small enough on screen that a screen pixel spans more than one atlas texel, `spr` floors
   at `1.0`, and a POSITIVE `outlineBias` then paints a flat, uniform haze across the WHOLE
   quad's background rather than a thin edge (`sigDist` for a fully-"outside" texel is only
   `0.5` away from the alpha=0 threshold regardless of `spr`, once `spr` is at its floor).
   Fixed with `outlineDampen` — a `spr`-dependent ramp that zeroes the outline contribution
   exactly at the floor and reaches full strength by `spr == 2`, so a shrinking caption
   loses its outline gracefully instead of blooming into a block.

With both fixed, the remaining approximation is width only: the vendored atlas's own
per-glyph padding bounds how far a `distanceBias` shift can dilate before the outline
visibly SQUARES OFF (reads as the glyph's own bounding rectangle rather than a rounded
band) — measured directly against `unit-box-mesh.tscn`'s "BoxMesh Test" caption
(`font_size` 32, `pixel_size` 0.008, default `outline_size` 12): `MAX_DISTANCE_BIAS = 0.3`
is the largest value that kept every letter's outline rounded rather than square across
the three arbitration scenes below. That caps the achievable dilation well below Godot's
own for `outline_size` above roughly 4 (at `font_size` 32); a Label3D with a large
`outline_size` renders a thinner outline than Godot, not the full weight. This is an
accepted, documented trade — reusing the shared MSDF pipeline with zero new atlas bytes —
not a silent gap.

The calibration constant itself (`OUTLINE_DILATION_PX_PER_UNIT = 0.27` Godot px of
one-sided dilation per unit of `outline_size`) was measured against real Godot 4.6.3, not
derived: a single-glyph scratch scene (`text="H"`, `outline_size=32`,
`outline_modulate=black`, camera `(0,0,3)` looking at the origin, `pixel_size=0.01`)
rendered at `font_size=128` AND again at `font_size=64` both measured a one-sided outline
band of ≈13.4 screen px around the H's stems (half-max crossings of the
background/outline and outline/ink transitions in `pnpm ref:godot`'s own pixels) —
confirming the dilation is independent of `font_size`, exactly as `outline_size` being its
own absolute font-pixel quantity predicts. The screen-px measurement converted to Godot px
via the SAME glyph's own known atlas bounding-box width as a ruler (`H` = 28 atlas-bake px,
scale `fontSizePx/42`), rather than deriving the camera's world-to-screen scale, which
`--frame`/`--camera` do not print.

### Unparsed properties — unchanged scope

`vertical_alignment`, `autowrap_mode`, `width`, `render_priority`, and
`outline_render_priority` remain unparsed (see `types.ts`/`parser.ts`), so every Label3D
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
  this component does not call since `width` is unparsed. This was ALSO a latent bug in
  the pre-MSDF canvas renderer, which treated FILL as `LEFT` instead — fixed as part of
  this rewrite (`glyphLayout.test.ts` pins it against the C++ source).

## Auto-framing (a bug found and fixed while building this)

`React.lazy`-loading `LabelGlyphs` means a Label3D's glyph mesh does not exist in the
scene graph for a window after mount. `TscnCanvas.tsx`'s `CameraFit` auto-frames the camera
from whatever `THREE.Mesh` geometry is currently present (`frameSceneBounds.ts`), and its
LAST retry can fire before that lazy chunk resolves — measured directly: without a
synchronous stand-in, `unit-box-mesh.tscn` framed as if its two Label3D captions were
absent entirely, at one point overlapping the box mesh outright (frame computed from the
box's own ~2-unit extent instead of the ~4.5-unit spread the captions' Y positions
establish). A one-shot `pendingResourceCount`-based signal (the mechanism GLB loads use)
is not a safe substitute either: another resource's fast pending→settled transition can
retire that ONE shot before a Label3D's own request even registers.

The fix mirrors `nodes/3d/csg/CsgPrimitive.tsx`'s own async-loading precedent: `Component.tsx`
renders an invisible (`visible={false}`), always-present bounds-proxy `<mesh>`, sized by
summing each character's OWN advance (`openSansMetrics.ts`'s `getGlyphAdvanceUnits`, the
SAME per-character table `textLayout.ts`'s real shaping reads, so the two produce the SAME
width for this font — its vendored charset carries no kerning pairs at all, which is the
one thing the estimate skips) for width, `getLinePitchPx` for height — so `frameSceneBounds`
always sees a reasonable approximation of the label's footprint from the very first
synchronous render, with no atlas dependency (`openSansMetrics.ts` is a self-contained
~12KB metrics table, unlike the ~300KB atlas `LabelGlyphs.tsx` alone pulls in).

A cruder first cut (`text.length × the font's OVERALL average advance`, ignoring which
characters those actually are) measurably over-widened the frame for a caption-dominated
scene: a space's own advance is under half that average, so a multi-word caption's true
width is nowhere near `length × average` once it carries several. Measured on
`unit-material-heightmap.tscn`'s single 29-character caption (3 spaces): the flat estimate
pulled the whole frame ≈16% wider than necessary (the torus/sphere/box itself measurably
smaller on screen than the baseline's), while the per-character sum reproduces the real
shaped width almost exactly (that scene's object came out within ~2.5% of the baseline's
size). `frameSceneBounds` prefers framing too LARGE over too small (its own CSG-proxy
comment) — but "too large" still has to stay close, once the label itself (not some large
mesh alongside it) dominates the bounds union.

## Arbitration (representative sample, `pnpm ref:godot` vs `pnpm ref:ours`, restricted to disagreeing pixels)

Delta = sum of |channel difference| over every pixel where the committed baseline and the
new render actually disagree (excludes the ~90%+ of a 3D frame both sides already render
identically). Ratio < 1 means the new render is closer to Godot than the baseline was.

| Scene | Pixels disagreeing | Baseline Δ | New render Δ | Ratio | Direction |
| --- | --- | --- | --- | --- | --- |
| `unit-box-mesh` (small captions, default `outline_size` 12) | 1.76% | 2,793,797 | 2,954,800 | 1.058 | ≈ parity, new render marginally farther |
| `unit-material-ao` (medium captions) | 1.23% | 2,554,690 | 1,870,802 | 0.732 | new render closer |
| `example-hallway-mockup` (11 tiny captions) | 0.109% | 97,626 | 88,353 | 0.905 | new render closer |

`unit-box-mesh`'s two captions default `outline_size` to 12, well above the ≈4
(`font_size` 32) ceiling `MAX_DISTANCE_BIAS` imposes, so both captions render a visibly
thinner outline than Godot's own — the accepted trade documented above — yet the render is
still essentially at parity with the pre-MSDF canvas renderer overall (ratio 1.058, down
from an early build's 1.457 before the bounds-proxy width fix above; the outline-width gap
alone is a much smaller effect than that framing bug was). The other two samples are
closer to Godot than the pre-MSDF canvas renderer was, consistent with using Godot's own
vendored font instead of a host system font.

## Goldens moved (all 27 committed goldens whose fixture places a Label3D, vs the pre-MSDF baseline)

Measured directly (`pnpm ref:ours <fixture> --frame`, diffed byte-for-byte against each
committed `scripts/visual/baselines/<name>.png`) rather than through `pnpm test:visual`,
whose full run repeatedly stalled indefinitely on this host under concurrent load from
other sessions; this reaches every scene `pnpm test:visual` would, sequentially, with the
same capture path. 24 of the 27 diff directly; the remaining 3 additionally click-select a
node in the tree (`select:` in `scenes.mjs`), which only the full harness drives — not
diffed here, but their Label3D content is identical to `audio-stream-player-3d`'s own
(unselected) entry, already covered.

| Scene | Fixture | Pixels changed |
| --- | --- | --- |
| `plane-mesh` | `unit-plane-mesh.tscn` | 0.834% |
| `plane-rotated-scaled` | `edge-plane-rotated-scaled.tscn` | 0.423% |
| `arraymesh` | `unit-arraymesh.tscn` | 2.173% |
| `arraymesh-uv` | `unit-arraymesh-uv.tscn` | 2.164% |
| `arraymesh-compressed` | `unit-arraymesh-compressed.tscn` | 2.474% |
| `arraymesh-own-material` | `unit-arraymesh-own-material.tscn` | 3.225% |
| `material-metallic` | `unit-material-metallic.tscn` | 5.576% |
| `material-emissive` | `unit-material-emissive.tscn` | 12.238% |
| `material-heightmap` | `unit-material-heightmap.tscn` | 11.656% |
| `hallway-mockup` | `example-hallway-mockup.tscn` | 0.109% |
| `camera-basic` | `unit-camera-basic.tscn` | 0.670% |
| `audio-stream-player-3d` | `unit-audio-stream-player.tscn` | 0.922% |
| `box-mesh` | `unit-box-mesh.tscn` | 1.764% |
| `capsule-mesh` | `unit-capsule-mesh.tscn` | 3.480% |
| `cylinder-mesh` | `unit-cylinder-mesh.tscn` | 2.765% |
| `prism-mesh` | `unit-prism-mesh.tscn` | 2.969% |
| `torus-mesh` | `unit-torus-mesh.tscn` | 9.816% |
| `material-ao` | `unit-material-ao.tscn` | 1.232% |
| `material-normal-map` | `unit-material-normal-map.tscn` | 2.134% |
| `material-textured` | `unit-material-textured.tscn` | 2.910% |
| `material-override` | `unit-material-override.tscn` | 1.530% |
| `surface-material-override` | `unit-surface-material-override.tscn` | 3.171% |
| `material-features` | `integration-material-features.tscn` | 12.126% |
| `sprite3d` | `unit-sprite3d.tscn` | 1.587% |
| `camera3d-selected` | `unit-multi-camera.tscn` (select) | not directly diffed — see above |
| `audio-stream-player-3d-selected` | `unit-audio-stream-player.tscn` (select) | not directly diffed — see above |
| `audio-stream-player-3d-cone-selected` | `unit-audio-stream-player.tscn` (select) | not directly diffed — see above |

Movement correlates with how much of the frame the label's own glyphs occupy — a scene
with one large, legible caption (`material-emissive`, `material-heightmap`,
`material-features`, `torus-mesh`) moves the most, since MSDF Open Sans and the host's
Arial fallback occupy overlapping but non-identical pixels at that scale; `hallway-mockup`'s
11 tiny captions move almost nothing (0.109%, unchanged from before this rewrite) because a
caption a few pixels tall barely renders any ink either way. Spot-checked
`material-heightmap`/`torus-mesh`/`box-mesh` directly against `pnpm ref:godot`: object
position and size now match the baseline closely (within ~2.5%, down from ~16% before the
bounds-proxy width fix), so the remaining movement is glyph shape, not framing.

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
