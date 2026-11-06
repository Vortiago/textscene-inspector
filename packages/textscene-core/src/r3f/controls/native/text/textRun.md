# TextRun engine notes

The reasoning behind two values in `TextRunMesh.tsx`, too long for a code comment. Every cite is
Godot 4.6.3 source.

## The bake anchor (`bakeAnchorPx`)

`bakeAnchorPx` is how far the bake's line-top reference sits above the baseline, at the target
size.

- A run smaller than its line's size reads a few tenths of a pixel low. Godot's FreeType light
  hinting (`scene/theme/default_theme.h`'s `font_hinting`) snaps each size independently, and no
  rescale of one bake matches that (the richtextlabel sheet).
- A per-size whole-pixel ceiling is not the fix. It regresses a run at its line's own size, which
  is exact against Godot now, by most of a pixel, and three glyphs on one run show three
  residuals.
- Do not retry a closed-form fix without porting the hinter.

## The scene-font texture colour space

The scene-font canvas texture is `SRGBColorSpace`, not the 2D-canvas rule's `NoColorSpace`
(`canvas2DTextureDecode.ts`, with `rendering/viewport/hdr_2d` off, `rendering_server.cpp:3771` and
`texture_storage.cpp:754`).

- Measured, `NoColorSpace` dips 5/255 below the backdrop at a glyph edge, where Godot draws a
  monotonic ramp.
- Godot's glyph texture is `FORMAT_LA8`: a constant 255 colour with the coverage in alpha
  (`modules/text_server_adv/text_server_adv.cpp` `rasterize_bitmap`, about `:1170-1174`). So no
  RGB pair blends in the wrong order.
- This raster holds the run's colour in every texel, alpha 0 included (`colourRaster`), so no texel
  pair differs in RGB either. A linear filter and each mip level blend no black into an edge.
- The raster is read back from the canvas, not uploaded from it: a canvas keeps no colour under
  alpha 0.

## Each glyph draws from FreeType's bitmap

`paintSceneFontCanvas` draws each glyph that has an outline as FreeType draws it for Godot
(`glyphCoverage.ts`). `ftStroker.ts` strokes the outline ring and `ftGrays.ts` covers each pixel,
so a glyph matches Godot's bitmap to the level (`hintingTarget.test.ts`, `ftStroker.test.ts`). The
painter blends the bitmaps into the canvas with `putImageData`.

- A canvas fill of the same outline is off by up to 25 levels, and a canvas stroke by up to 27 on
  a curve, because Chromium's rasteriser does not cover by FreeType's integer cell sums.
- Measured in Node, a 16 px glyph takes 0.1 ms to fill and 0.8 ms to stroke, a 48 px glyph 0.2 ms
  and 0.8 ms. The painter keeps each bitmap for its contour, subpixel shift and radius, so a
  repaint at a new tint draws none again.
- The canvas asks for `willReadFrequently`, which keeps it in CPU memory for `getImageData`. A
  glyph with no outline draws its text there, on Chromium's CPU rasteriser, which covers by exact
  area where the GPU raster samples coverage.

## Each canvas run owns its raster

A run is one mesh and one draw call on every painter, so a shared raster would save a texture bind
and no draw call. Measured on lavapipe, 200 runs of 640 x 80 px draw a frame in 31 ms with a raster
each and 26 ms with one raster for all. That is 0.025 ms for each run, and an upper bound, as a
packed atlas samples distinct regions too. A packed atlas would also repack on every text change.

## The canvas raster sits on whole item pixels

Godot draws a glyph at scale 1 at the floored `cpos` (`text_server_adv.cpp:4082-4084`), in the
canvas item's own coordinates. `useCanvasItemOrigin` gives a run its place in those coordinates.
The quad moves back to the whole pixel at or before that place (`originPhase`), each pen rounds
past it, and each baseline floors. Label3D keeps its pen, as its mesh places each glyph.
