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
- This raster bakes ink into RGB. At 3x an `(0,0)` texel sits beside `(ink,255)`, and the
  pre-filter decode hides that fringe.
- A raster split into coverage plus a modulated colour would reopen this choice.
