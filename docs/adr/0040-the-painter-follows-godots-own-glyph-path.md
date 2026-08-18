# The painter follows Godot's own glyph path, not the font's provenance

- Status: Accepted (2026-08-18). **Supersedes ADR-0034.**
- Related: ADR-0037 (Control nodes render natively in the canvas — the 2D text
  this decision leaves on the atlas is that decision's text). ADR-0026
  (comparison sheets live in their slice — the per-node limitations below are
  recorded there as well as here).

## Context

ADR-0034 carried two glyph painters and split them by **font provenance**: the
bundled Open Sans SemiBold drew from a build-time MSDF atlas, and a
scene-authored font — arbitrary bytes that do not exist until a scene is opened
— drew through a runtime `FontFace` + canvas-2D raster. Everything that split
was built ON still stands and is not reopened here:

- **One shaping engine.** `textLayout.ts` shapes both paths against the
  `FontMetrics` contract, and every design-unit→pixel conversion lives once in
  `fontMetrics.ts`. A font changes the numbers fed to one shaper; it never gets
  a shaper of its own.
- **No host fonts, ever.** Naming a system font and letting the machine resolve
  it is the defect that line of work removed, and it is not revisitable.
- **The CSP finding.** Runtime MSDF generation needs a worker, and the VS Code
  webview's `default-src 'none'` leaves `worker-src` and `connect-src` at
  `'none'`. Measured, negative-controlled, and now guarded at the real origin by
  `pnpm test:vscode:csp`.

What the split got wrong is the AXIS, and `Label3D` is where that showed.

Godot's default project font is **not MSDF**:
`gui/theme/default_font_multichannel_signed_distance_field` defaults to `false`
(`servers/text/text_server.cpp:2386`), read into the default theme's font at
`scene/theme/theme_db.cpp:59`. So the engine rasterises the bundled default
through FreeType — and for an outline it does not dilate anything, it strokes a
real contour annulus with `FT_Stroker`. The radius is not small:
`_get_size_outline` passes the outline size UNSCALED while the font size goes to
26.6 (`modules/text_server_adv/text_server_adv.h:406-414`), and
`FT_Stroker_Set(stroker, (int)(fd->size.y * 16.0), FT_STROKER_LINECAP_BUTT,
FT_STROKER_LINEJOIN_ROUND, 0)` (`text_server_adv.cpp:1383`) reads a 26.6 radius,
so the one-sided radius is `outline_size / 4` px — 3 px at Label3D's default
`outline_size = 12`, i.e. ~3.94 atlas px against a field that encodes ±2. The
atlas approximation was capped below what it needed and damped to nothing on
small captions.

That is a `Label3D` drawing the SAME bundled font as a 2D `Label`, needing a
different painter. Provenance cannot express it, because provenance is not what
decides: two nodes can share a font and still go down different paths inside
Godot's own text server. The MSDF branch and the FreeType-bitmap branch are two
arms of one `if` in one rasteriser (`text_server_adv.cpp:1360-1373`, guarded
`if (!outline)` — the stroked path is a third arm again).

## Decision

**Which painter draws a run is decided by which engine path Godot itself takes
for that text.**

The two painters and the dispatch mechanism are unchanged. What changed is what
each one ANSWERS:

- **Painter A — the baked MSDF atlas.** A stand-in for FreeType's coverage
  bitmap, used where the distance field can carry the whole of what Godot
  produces: a FILLED glyph of the bundled font, at the 2D stage's own scale.
  Its callers are the six 2D Control text painters — `Label`, `RichTextLabel`,
  `Button`, `CheckBox`, `OptionButton`, `LineEdit` — whenever they resolve to the
  bundled default rather than a scene-authored font (`resolveNodeFontMetrics`).
- **Painter B — runtime `FontFace` + canvas-2D raster.** Used wherever Godot's
  own path produces something the field cannot carry. Two cases: a
  scene-authored font, for which no bake exists at all; and `Label3D`, whose
  outline is a stroked contour annulus. `Label3D` takes it for ALL of its text,
  outline or not — one painter draws a caption, so an `outline_size` of 0 and of
  12 differ in the stroke and in nothing else.

Dispatch is still internal to `TextRun.tsx`, still on the
`kind: 'atlas' | 'canvas'` discriminant the metrics carry (`fontMetrics.ts`), and
no per-slice `Component.tsx` knows a second path exists. What the new axis needed
was a way for the bundled font to take painter B without changing a single
number: `createOpenSansCanvasFontMetrics` (`openSansCanvasFontMetrics.ts`) wraps
`OPEN_SANS_FONT_METRICS` as `'canvas'`-kind. Only the rasteriser changes. Every
advance, kerning pair and scalar still reads through the generated baked table —
never `createRuntimeFontMetrics`, whose advances are `measureText` floats that
would enter `getFontGlyphAdvancePx`'s fixed-point chain up to a 1/64 px step off
and drift this font's shaping from every other consumer of it, and from Godot.

### The rule, stated so a third caller can apply it

If Godot rasterises the run through FreeType and the result is a filled coverage
bitmap, the baked field is an exact-enough stand-in and painter A draws it. If
the result is anything the field cannot encode — a stroked contour annulus above
all — painter B is the only faithful one, whatever font it is. If there is no
bake, painter B, for the reason ADR-0034 gave.

`Label3D`'s outline follows Godot's model rather than approximating it: outline
glyphs are generated FIRST, as their own surfaces at their own render priority
(`scene/3d/label_3d.cpp:610-621`), both surfaces `TRANSPARENCY_ALPHA` (`:386`),
ordered by `material_set_render_priority` into an ascending sort (`:402`) — which
is what three's `renderOrder` gives. A centred canvas stroke of twice the radius,
with the stroker's own round join and butt cap, draws the same both-borders
annulus. That branch is exclusive on Godot's side too: once `alpha_cut` leaves
`TRANSPARENCY_ALPHA` the priority comparator no longer applies and Godot shifts
vertex z instead (`:404`).

## Considered options

- **Keep `Label3D` on the atlas and approximate the outline by dilation.** What
  this replaces. A distance field encoding ±2 cannot express a ~3.94 px stroke,
  so the dilation had a bias, a damping term and a calibrated constant, all
  tuned against pictures rather than derived from anything. All three are gone.
- **Bake a wider field, or a larger atlas.** Widens the encodable range at a
  bundle cost paid by the six 2D callers that never needed it, and still
  approximates a contour stroke with a dilated fill — a different SHAPE, not a
  smaller error.
- **Runtime MSDF generation for `Label3D`.** Same CSP blocker ADR-0034 measured;
  unchanged.
- **Move the 2D callers to the raster too, for one painter.** Rejected: it would
  pay the trades below for six call sites that do not need them, and lose the
  atlas's scale invariance in the one place — a 2D stage the user zooms — where
  it is most visible.

## Consequences

- **Scale invariance is gone for the text that moved.** An MSDF is resolution
  independent; a canvas raster is not. ADR-0034 discharged this for scene fonts
  by pointing at the 2D parity capture rendering at zoom 1, and **that reasoning
  does not transfer**: a `Label3D` is a billboard in a 3D scene, viewed at
  whatever distance the camera happens to be. The mitigation is a fixed
  supersample (`CANVAS_TEXT_SUPERSAMPLE = 3`), which is a documented quality/perf
  trade rather than a fix, and deliberately not adaptive.
- **Byte determinism against a build artifact is gone for the text that moved.**
  The atlas is baked at build time and ships as bytes; a raster is produced at
  view time by the BROWSER's own text rasteriser (Skia, in Chromium) under its
  own hinting, antialiasing and subpixel-positioning choices. Godot's are project
  settings (`gui/theme/default_font_antialiasing`, `…_hinting`,
  `…_subpixel_positioning` — `text_server.cpp:2382-2384`, read at
  `theme_db.cpp:55-57`) that this previewer does not honour, so byte-identity
  with Godot's FreeType output is not available and must not be claimed in a
  golden's name. The goldens still require an exact reproduction of our OWN
  capture; what changed is that a browser upgrade is now a rebaseline event for
  these scenes rather than a no-op. ADR-0034's own adjacent measurement is the
  same fact one layer up: Chromium's font metrics matched a real font's `hhea`
  exactly at a 1000px reference and drifted up to 12.5 design units at realistic
  sizes.
- **Nothing paints until `document.fonts` has the family.** `ctx.fillText`
  against an unregistered family silently rasterises a SYSTEM font, and those
  pixels are frame-stable, so the settle gate cannot catch it. This is the one
  failure mode that would quietly reintroduce the host-font dependency ADR-0034
  removed, which is why the bundled font goes through the same registration door
  as a scene font (`sceneFontLoader.ts`) and `Label3D` withholds its metrics
  until that resolves.
- **The atlas is not retired**, and this decision is not a step toward retiring
  it. It still serves all six 2D callers, still costs nothing at runtime, and
  still rides the lazy controls chunk.
- **Two painters is still a real cost**, recorded here for ADR-0034's reason: so
  the next reader finds a stated axis instead of what looks like drift, and does
  not "clean it up" by deleting the path a caller's engine path requires.
