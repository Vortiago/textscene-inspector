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
the arbitration scenes below. That caps the achievable dilation well below Godot's
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

## Auto-framing (two bugs found while building this — one fixed here, one Label3D-adjacent but NOT this component's to fix)

### Bug 1 — a lazily-mounted glyph mesh framed as if the caption were absent (FIXED)

`React.lazy`-loading `LabelGlyphs` means a Label3D's glyph mesh does not exist in the
scene graph for a window after mount. `TscnCanvas.tsx`'s `CameraFit` auto-frames the camera
from whatever geometry is currently present (`frameSceneBounds.ts`), and its retries can
fire before that lazy chunk resolves — measured directly: without a synchronous stand-in,
`unit-box-mesh.tscn` framed as if its two Label3D captions were absent entirely. The fix
mirrors `nodes/3d/csg/CsgPrimitive.tsx`'s own async-loading precedent: `Component.tsx`
renders an invisible (`visible={false}`), always-present bounds-proxy `<mesh>`.

What that proxy should be SIZED as went through two wrong answers before the measured one,
each caught by comparing against Godot's own reference render rather than assumed correct:

1. **A flat estimate (`text.length × the font's average advance`).** Over-widened the frame
   for a caption-dominated scene — a space's own advance is under half that average, so a
   multi-word caption's true width is nowhere near `length × average` once it carries
   several. Measured on `unit-material-heightmap.tscn`: ≈16% wider than necessary.
2. **The exact per-character shaped width, then Godot's OWN billboard-cube AABB inflation**
   (`label_3d.cpp:625-638`: for `BILLBOARD_ENABLED`, a label's rect inflates into a CUBE
   sized by the larger of its half-width/half-height, because Godot's billboard rotation is
   shader-only and never touches the actual `Transform3D`/AABB). This one MATCHED Godot's
   own `--emit-bounds` output almost exactly — and still measurably made auto-framing
   WORSE, not better, against Godot's actual `--frame` picture (torus-mesh, material-emissive,
   material-heightmap all regressed; see "the mechanism", below).
3. **A zero-size point at the node's own local origin** (what ships now). Reproduces
   Godot's `--frame` picture exactly, for the reason in the next section.

### The mechanism: `--emit-bounds` is not what placed the camera

`scripts/godot-ref/run.mjs`'s bootstrap calls Godot's own `_scene_bounds()` TWICE:
`_place_camera` calls it synchronously, right after `add_child()`, before any frame has
rendered; `_write_bounds` (which `--emit-bounds` reads) calls it again LATER, after
`_settle()` (six process frames + a compositor flush) — and only after the reference PNG
has already been saved. For a scene with no Label3D these two calls agree, so the gap had
never surfaced before. For a scene WITH one they can disagree, because a fresh Label3D's
shaped-text AABB is not available synchronously on `add_child()` (despite
`NOTIFICATION_ENTER_TREE` requesting an update — some part of `TextServer` shaping
evidently lands a frame or more later).

Measured directly, by instrumenting the bootstrap to write both calls' results for
`unit-torus-mesh.tscn` (one `TorusMesh`, two Label3D captions at Y=+2/-2):

| Call | Position | Size |
| --- | --- | --- |
| Pre-settle (`_place_camera`'s own view) | `[-1.5, -2.0, -1.5]` | `[3.0, 4.0, 3.0]` |
| Post-settle (`--emit-bounds`'s view) | `[-2.469, -4.469, -2.469]` | `[4.938, 7.445, 4.938]` |

The pre-settle box is exactly the TorusMesh's own extent (outer radius 1.5) unioned with
the two Label3D nodes' bare Y POSITIONS — each contributing no width, no height, no
billboard inflation, only its own origin. Rendering the camera the pre-settle box derives
(`--camera 1.9226,2.1905,3.5197 --look-at 0,0,0`) reproduces Godot's own `--frame` picture
pixel-for-pixel (measured: 0.105 average per-pixel channel difference, consistent with
ordinary render noise); a camera derived from the larger, post-settle box does not — it
renders the SAME undersized torus this renderer's own cube-inflated proxy did.

So `--frame` — the camera every golden is measured against — is placed from a scene-graph
state in which Label3D has not yet shaped anything, every time. `--emit-bounds` is a true
read of the FINAL scene bounds; it is simply not the number that produced the picture,
because it is read later, after the picture was already saved. No estimate of a Label3D's
rendered extent belongs in a framing decision — not the flat average, not the per-character
shaped width, not Godot's own eventual billboard-cube geometry — because Godot's own framing
decision never has that number available either. The bounds-proxy is now a zero-size point
at the node's local origin, and the real (lazily-mounted) glyph mesh is tagged
`tscnFrameExcluded` (`TextRun.tsx`) so `frameSceneBounds.ts` skips it outright — otherwise an
incidental async-mount-timing accident (the chunk resolving inside vs. outside `CameraFit`'s
retry window) would make the auto-fit bounds depend on load speed, deterministic on no host.

### Bug 2 — a pre-existing, NOT Label3D-caused, camera-ANGLE divergence the point-fix exposed for one fixture (flagged, not fixed here)

Fixing bug 1 removed the ONLY thing keeping one fixture,
`unit-arraymesh-own-material.tscn`, out of `frameSceneBounds.ts`'s separate `isFlat` branch
(`size.z <= max(maxXY, 1) * 0.02` picks a head-on camera instead of Godot's own isometric
one). That fixture's real geometry (two coplanar quads, thickness 0) was ALWAYS
dimensionally flat; its Label3D captions used to contribute a non-zero Z (first via the
per-character rect's own non-flat cases, later via the billboard-cube inflation), which
incidentally kept the scene out of the `isFlat` branch. The point-proxy correctly reports
zero Z (verified: Godot's own pre-settle `_scene_bounds()` for this exact fixture is ALSO
`size: [4.2, 3.6, 0]`), so the scene now correctly reads as flat — and framed head-on,
diverging sharply from Godot's own reference camera as a result (ratio 5.70, see
"Arbitration" below).

This is not a bug in the point-proxy or in bug 1's fix: measured directly, `isFlat`'s
head-on branch diverges from Godot's own `--frame` camera UNCONDITIONALLY, independent of
Label3D entirely — `unit-quadmesh.tscn` (no Label3D anywhere in the fixture) renders
head-on in this app but obliquely in Godot's own reference. A census of all 97 3D-mode
golden fixtures found 5 total that ever take the `isFlat` branch — `arraymesh-own-material`,
`material-emission-texture`, `quadmesh`, `sprite3d`, `sprite3d-region-oversized` — of which
only `arraymesh-own-material` changed classification as a result of this rewrite; the other
4 have taken it since before this component existed, and their committed goldens already
encode a camera Godot does not produce. Removing `isFlat` outright would correct all 5 at
once, but 4 of those goldens are untouched by this change and outside its scope — recorded
here as a follow-up, not fixed in this pass.

## Arbitration (`pnpm ref:godot --frame` vs `pnpm ref:ours --frame`, restricted to disagreeing pixels)

Delta = sum of |channel difference| over every pixel where the committed baseline and the
new render actually disagree (excludes the pixels both sides already render identically).
Ratio = new-render Δ / baseline Δ; ratio < 1 means the new render is closer to Godot's own
`--frame` reference than the previously-committed baseline was.

| Scene | Pixels disagreeing | Baseline Δ | New render Δ | Ratio | Direction |
| --- | --- | --- | --- | --- | --- |
| `unit-torus-mesh` | 91,205 | 8,929,395 | 2,238,355 | 0.251 | new render closer |
| `unit-material-emissive` | 173,601 | 16,310,897 | 3,186,686 | 0.195 | new render closer |
| `unit-material-heightmap` | 124,106 | 12,146,122 | 6,358,181 | 0.524 | new render closer |
| `integration-material-features` | 170,665 | 22,558,263 | 2,641,611 | 0.117 | new render closer |
| `unit-arraymesh-own-material` (Bug 2, `isFlat` — see above) | 520,275 | 15,774,075 | 89,913,341 | 5.700 | new render FARTHER (pre-existing `isFlat` divergence, not this fix) |

The first four are the scenes the billboard-cube-inflation attempt had regressed (ratios
1.264-2.032 against Godot before this fix); the point-proxy + `tscnFrameExcluded` fix brings
all four measurably closer to Godot instead — matching Godot's OWN camera exactly (as
opposed to matching `--emit-bounds`, a number Godot itself never used to take the picture).
`unit-arraymesh-own-material` is the one exception, and its cause is `isFlat` (Bug 2 above),
confirmed by measuring Godot's own pre-settle bounds for that exact fixture (`size: [4.2,
3.6, 0]` — genuinely flat, and Godot still framed it obliquely).

`unit-box-mesh` (small captions, default `outline_size` 12, well above the ≈4 ceiling
`MAX_DISTANCE_BIAS` imposes) also carries two billboarded Label3D captions and moves the
same direction as the four above: ratio 0.235 (5,211,235 → 1,222,610 Δ, 21,305 disagreeing
pixels) — closer to Godot despite the accepted thinner-outline trade documented above,
because the framing fix is the dominant effect on this scene too.

## Goldens moved (all 27 committed goldens whose fixture places a Label3D, vs the pre-MSDF baseline)

Measured directly (`pnpm ref:ours <fixture> --frame`, pixelmatch-diffed against each
committed `scripts/visual/baselines/<name>.png` with the SAME `threshold: 0.1` `pnpm
test:visual` itself uses) rather than through `pnpm test:visual`, whose full run repeatedly
stalled indefinitely on this host under concurrent load from other sessions; this reaches
every scene `pnpm test:visual` would, sequentially, with the same capture path. 24 of the 27
diff directly; the remaining 3 additionally click-select a node in the tree (`select:` in
`scenes.mjs`), which only the full harness drives — not diffed here, but their Label3D
content is identical to `audio-stream-player-3d`'s own (unselected) entry, already covered.

| Scene | Fixture | Pixels changed |
| --- | --- | --- |
| `plane-mesh` | `unit-plane-mesh.tscn` | 0.504% |
| `plane-rotated-scaled` | `edge-plane-rotated-scaled.tscn` | 0.222% |
| `arraymesh` | `unit-arraymesh.tscn` | 6.139% |
| `arraymesh-uv` | `unit-arraymesh-uv.tscn` | 7.371% |
| `arraymesh-compressed` | `unit-arraymesh-compressed.tscn` | 7.921% |
| `arraymesh-own-material` | `unit-arraymesh-own-material.tscn` | **53.066%** — `isFlat` camera-angle flip, NOT this fix's glyph/framing change; see Bug 2 above |
| `material-metallic` | `unit-material-metallic.tscn` | 4.959% |
| `material-emissive` | `unit-material-emissive.tscn` | 6.363% |
| `material-heightmap` | `unit-material-heightmap.tscn` | 5.142% |
| `hallway-mockup` | `example-hallway-mockup.tscn` | 0.012% |
| `camera-basic` | `unit-camera-basic.tscn` | 3.438% |
| `audio-stream-player-3d` | `unit-audio-stream-player.tscn` | 0.549% |
| `box-mesh` | `unit-box-mesh.tscn` | 1.842% |
| `capsule-mesh` | `unit-capsule-mesh.tscn` | 2.199% |
| `cylinder-mesh` | `unit-cylinder-mesh.tscn` | 3.067% |
| `prism-mesh` | `unit-prism-mesh.tscn` | 3.922% |
| `torus-mesh` | `unit-torus-mesh.tscn` | 3.717% |
| `material-ao` | `unit-material-ao.tscn` | 0.629% |
| `material-normal-map` | `unit-material-normal-map.tscn` | 0.503% |
| `material-textured` | `unit-material-textured.tscn` | 4.424% |
| `material-override` | `unit-material-override.tscn` | 3.406% |
| `surface-material-override` | `unit-surface-material-override.tscn` | 3.755% |
| `material-features` | `integration-material-features.tscn` | 10.823% |
| `sprite3d` | `unit-sprite3d.tscn` | 1.200% |
| `camera3d-selected` | `unit-multi-camera.tscn` (select) | not directly diffed — see above |
| `audio-stream-player-3d-selected` | `unit-audio-stream-player.tscn` (select) | not directly diffed — see above |
| `audio-stream-player-3d-cone-selected` | `unit-audio-stream-player.tscn` (select) | not directly diffed — see above |

All 23 scenes other than `arraymesh-own-material` moved LESS than they did at the previous
(billboard-cube-inflation) framing state, consistent with the arbitration table above: the
point-proxy fix pulls the camera to the same position Godot's own reference uses, so what
remains is glyph shape (MSDF Open Sans vs. the host's Arial fallback occupying overlapping
but non-identical pixels), not a framing gap. `hallway-mockup`'s 11 tiny captions move
almost nothing (0.012%) because a caption a few pixels tall barely renders any ink either
way. `arraymesh-own-material` is the sole outlier, and its cause is fully accounted for
above (Bug 2, `isFlat`) — it is not evidence of a glyph or framing regression in this
rewrite, and rebaselining it without also addressing `isFlat` would commit a picture that
diverges from Godot's own reference by 5.7x more than the fixture's current baseline does.

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
