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
- This raster bakes ink into RGB. An `(0,0)` texel sits beside an `(ink,255)` texel, and the
  pre-filter decode hides that fringe.
- A raster split into coverage plus a modulated colour would reopen this choice.

## The scene-font raster runs on the CPU

`paintSceneFontCanvas` asks for `willReadFrequently`, which keeps the 2D canvas on Chromium's CPU
rasteriser. That rasteriser computes exact-area coverage, as FreeType's smooth rasteriser does
for Godot's `FT_RENDER_MODE_NORMAL` (`text_server_adv.cpp:1323`). Chromium's GPU raster samples
coverage instead, and no canvas option changes how it anti-aliases. So only the CPU raster can
draw Godot's outline.

- Measured with 60 slanted stems 0.6 px wide on lavapipe, the GPU raster puts down 3 coverage
  levels and the CPU raster 140. On SwiftShader, which has no GPU raster, both put down 140.
- Measured against Godot with hinting off on both sides, every embolden row from 8 px to 128 px
  is within 2% on the CPU raster. On the GPU raster, the 8 px rows lose 2.4% of the ink.
- The cost is the paint and upload of each raster, once per text change. For a 640 x 80 px raster
  of filled contours on lavapipe, the CPU canvas takes 3.2 ms and the GPU canvas 0.15 ms. On
  SwiftShader both take 0.5 ms.

## Each canvas run owns its raster

A run is one mesh and one draw call on every painter, so a shared raster would save a texture bind
and no draw call. Measured on lavapipe, 200 runs of 640 x 80 px draw a frame in 31 ms with a raster
each and 26 ms with one raster for all. That is 0.025 ms for each run, and an upper bound, as a
packed atlas samples distinct regions too. A packed atlas would also repack on every text change.

## The canvas raster sits on whole item pixels

Godot draws a glyph at scale 1 at the floored `cpos` (`text_server_adv.cpp:4082-4084`), in the
canvas item's own coordinates. `useCanvasItemOrigin` gives a run its place in those coordinates.
The quad moves back to the whole pixel at or before that place (`itemPixelSnap`), each pen rounds
past it, and each baseline floors. Label3D keeps its pen, as its mesh places each glyph.
