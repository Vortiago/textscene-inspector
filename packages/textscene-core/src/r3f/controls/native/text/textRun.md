# TextRun engine notes

The reasoning behind two values in `TextRun.tsx`, too long for a code comment. Every cite is
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
rasteriser. That rasteriser computes exact-area coverage, as FreeType's does.

- Measured against Godot with hinting off on both sides, every embolden row from 8 px to 128 px
  is within 2% on the CPU raster.
- On the GPU raster, the 8 px rows lose 2.4% of the ink, and a stem near zero width loses more.
- The cost is the upload of each raster, once per text change. Measured for a 640 x 80 px raster
  on lavapipe, the CPU canvas takes 4.8 ms to upload where the GPU canvas takes 0.15 ms. On
  SwiftShader, which rasterises both on the CPU, both take 0.6 ms.
