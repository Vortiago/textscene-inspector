# The painter follows Godot's own glyph path, not the font's provenance

- Status: Accepted. **Supersedes ADR-0034.**
- Related: ADR-0037 (Control nodes render natively in the canvas: the 2D text this
  decision leaves on the atlas is that decision's text), ADR-0026 (comparison sheets live
  in their slice: the per-node limitations below are recorded there too).

## Context

ADR-0034 carries two glyph painters and splits them by **font provenance**: the bundled
Open Sans SemiBold draws from a build-time MSDF atlas, and a scene-authored font
(arbitrary bytes that do not exist until a scene opens) draws through a runtime
`FontFace` + canvas-2D raster. What that split rests on stands, and this ADR does not
reopen it:

- **One shaping engine.** `textLayout.ts` shapes both paths against the `FontMetrics`
  contract, and each design-unit→pixel conversion lives once in `fontMetrics.ts`. A font
  changes the numbers fed to one shaper. It never gets a shaper of its own.
- **No host fonts, ever.** A system font that the machine resolves by name is a defect,
  and it is not revisitable.
- **The CSP finding.** Runtime MSDF generation needs a worker, and the VS Code webview's
  `default-src 'none'` leaves `worker-src` and `connect-src` at `'none'`. It is measured,
  negative-controlled, and guarded at the real origin by `pnpm test:vscode:csp`.

What the split gets wrong is the axis, and `Label3D` shows it.

Godot's default project font is **not MSDF**:
`gui/theme/default_font_multichannel_signed_distance_field` defaults to `false`
(`servers/text/text_server.cpp:2386`), read into the default theme's font at
`scene/theme/theme_db.cpp:59`. So the engine rasterises the bundled default through
FreeType, and for an outline it does not dilate: it strokes a real contour annulus with
`FT_Stroker`. The radius is not small. `_get_size_outline` passes the outline size
unscaled while the font size goes to 26.6
(`modules/text_server_adv/text_server_adv.h:406-414`), and
`FT_Stroker_Set(stroker, (int)(fd->size.y * 16.0), FT_STROKER_LINECAP_BUTT,
FT_STROKER_LINEJOIN_ROUND, 0)` (`text_server_adv.cpp:1383`) reads a 26.6 radius. So the
one-sided radius is `outline_size / 4` px: 3 px at Label3D's default `outline_size = 12`,
that is ~3.94 atlas px, against a field that encodes ±2. An atlas approximation is capped
below what it needs and damps to nothing on small captions.

So a `Label3D` that draws the same bundled font as a 2D `Label` needs a different
painter. Provenance cannot express that, because provenance does not decide: two nodes
can share a font and still take different paths inside Godot's own text server. The MSDF
branch and the FreeType-bitmap branch are two arms of one `if` in one rasteriser
(`text_server_adv.cpp:1360-1373`, guarded `if (!outline)`), and the stroked path is a
third arm.

## Decision

**The engine path that Godot itself takes for a run of text decides which painter draws
it.**

The two painters and the dispatch mechanism stay. What changes is what each one answers:

- **Painter A: the baked MSDF atlas.** A stand-in for FreeType's coverage bitmap, used
  where the distance field can carry all of what Godot produces: a filled glyph of the
  bundled font, at the 2D stage's own scale. Its callers are the six 2D Control text
  painters, `Label`, `RichTextLabel`, `Button`, `CheckBox`, `OptionButton` and
  `LineEdit`, whenever they resolve to the bundled default and not a scene-authored font
  (`resolveNodeFontMetrics`).
- **Painter B: runtime `FontFace` + canvas-2D raster.** Used wherever Godot's own path
  produces something the field cannot carry. There are two cases: a scene-authored font,
  which has no bake, and `Label3D`, whose outline is a stroked contour annulus.
  `Label3D` takes painter B for all of its text, outline or not. One painter draws a
  caption, so an `outline_size` of 0 and of 12 differ in the stroke and in nothing else.

Dispatch is internal to `TextRun.tsx`, on the `kind: 'atlas' | 'canvas'` discriminant
the metrics carry (`fontMetrics.ts`), and no per-slice `Component.tsx` knows a second
path exists. The new axis needs a way for the bundled font to take painter B without a
change to any number. `createOpenSansCanvasFontMetrics` (`openSansCanvasFontMetrics.ts`)
wraps `OPEN_SANS_FONT_METRICS` as `'canvas'`-kind. Only the rasteriser changes. Each
advance, kerning pair and scalar reads through the generated baked table, never
`createRuntimeFontMetrics`. Its advances are `measureText` floats that would enter the
fixed-point chain of `getFontGlyphAdvancePx` up to a 1/64 px step off, and drift this
font's shaping from each other consumer of it, and from Godot.

### The rule, stated so a third caller can apply it

If Godot rasterises the run through FreeType and the result is a filled coverage bitmap,
the baked field is an exact-enough stand-in, and painter A draws it. If the result is
anything the field cannot encode, a stroked contour annulus above all, painter B is the
only faithful one, whatever the font. If there is no bake, painter B draws it, for the
reason ADR-0034 gives.

`Label3D`'s outline follows Godot's model and does not approximate it. Outline glyphs are
generated first, as their own surfaces at their own render priority
(`scene/3d/label_3d.cpp:610-621`), both surfaces `TRANSPARENCY_ALPHA` (`:386`), and
ordered by `material_set_render_priority` into an ascending sort (`:402`), which is what
three's `renderOrder` gives. A centred canvas stroke of twice the radius, with the
stroker's own round join and butt cap, draws the same both-borders annulus. That branch
is exclusive on Godot's side too: once `alpha_cut` leaves `TRANSPARENCY_ALPHA`, the
priority comparator no longer applies, and Godot shifts vertex z instead (`:404`).

## Considered options

- **Keep `Label3D` on the atlas and approximate the outline by dilation.** A distance
  field that encodes ±2 cannot express a ~3.94 px stroke, so a dilation needs a bias, a
  damping term and a calibrated constant, all tuned against pictures and derived from
  nothing.
- **Bake a wider field, or a larger atlas.** It widens the encodable range at a bundle
  cost paid by the six 2D callers that do not need it, and still approximates a contour
  stroke with a dilated fill: a different shape, not a smaller error.
- **Runtime MSDF generation for `Label3D`.** The same CSP blocker ADR-0034 measured.
- **Move the 2D callers to the raster too, for one painter.** Rejected: it pays the
  trades below for six call sites that do not need them, and loses the atlas's scale
  invariance in the place where it is most visible, a 2D stage the user zooms.

## Consequences

- **The text on painter B is not scale-invariant.** An MSDF is resolution independent,
  and a canvas raster is not. ADR-0034 discharged this for scene fonts because the 2D
  parity capture renders at zoom 1, and **that reasoning does not transfer**: a `Label3D`
  is a billboard in a 3D scene, viewed at whatever distance the camera is. The
  mitigation is a fixed supersample (`CANVAS_TEXT_SUPERSAMPLE = 3`), a documented
  quality/performance trade, not a fix, and not adaptive on purpose.
- **The text on painter B is not byte-deterministic against a build artefact.** The
  atlas is baked at build time and ships as bytes. A raster is produced at view time by
  the browser's own text rasteriser (Skia, in Chromium), under its own hinting,
  antialiasing and subpixel-positioning choices. Godot's are project settings
  (`gui/theme/default_font_antialiasing`, `…_hinting`, `…_subpixel_positioning`,
  `text_server.cpp:2382-2384`, read at `theme_db.cpp:55-57`) that this previewer does not
  honour, so byte-identity with Godot's FreeType output is not available, and a golden's
  name must not claim it. The goldens still require an exact reproduction of the
  previewer's own capture, but a browser upgrade is a rebaseline event for these scenes.
  ADR-0034's adjacent measurement is the same fact one layer up: Chromium's font metrics
  match a real font's `hhea` exactly at a 1000px reference and drift up to 12.5 design
  units at realistic sizes.
- **Nothing paints until `document.fonts` has the family.** `ctx.fillText` against an
  unregistered family silently rasterises a system font, and those pixels are
  frame-stable, so the settle gate cannot catch it. This is the one failure mode that
  would quietly bring back the host-font dependency. So the bundled font goes through
  the same registration door as a scene font (`sceneFontLoader.ts`), and `Label3D` holds
  back its metrics until that resolves.
- **The atlas is not retired**, and this decision is not a step toward retiring it. It
  serves all six 2D callers, costs nothing at runtime, and rides the lazy controls
  chunk.
- **Two painters is a real cost.** Do not delete the path that a caller's engine path
  requires to "clean it up".
