# A BMFont draws its page images as glyph quads

- Status: Accepted
- Related: ADR-0040 (the painter follows Godot's glyph path), ADR-0059 (project fonts), ADR-0031 (resource slices).

## Context

A `.fnt` or `.font` file is an AngelCode bitmap font. Godot loads it into a `FontFile` that holds
glyph rectangles over page images, a fixed size and a scale mode (`font.cpp:1463`). The text server
draws each glyph as a texture rectangle at `fixed_size`, scaled to the requested size
(`text_server_adv.cpp:4072-4108`). The two painters of ADR-0040 do not fit. The atlas painter
reads glyphs from the bundled font, and the canvas painter rasterises outlines.

## Decision

A BMFont is a third face kind, `bitmap`. The `bmfont` resource slice parses the descriptor and
decodes each page into fills, and the font processor joins them into a `BitmapFont` on the
`FontFileResource`. A page that fails to load fails the font, as in Godot.

The shaper in `textLayout.ts` reads the descriptor's advances, offsets and kerning in font units
and scales them by the fixed-size scale. A missing glyph gets a hex-code box advance.

`bitmapTextPainter.ts` stacks the page fills into one sheet and draws one quad per glyph in one
mesh. It floors the pen position when the scale is 1, as `font_draw_glyph` does, and adds no
subpixel shift, because a BMFont `FontFile` resets to `SUBPIXEL_POSITIONING_DISABLED`
(`font.cpp:1433`).

An outline pass draws the font's outline set at the glyph's own rectangle. A fixed-size font caps
the outline size at 1 for its cache (`text_server_adv.h:406-414`), so every `outline_size` above 0
draws the same set.

## Consequences

A character the descriptor lacks draws a hex-code box, where Godot draws it from the font's
`fallbacks`. No font kind has a per-glyph fallback search yet. Label3D and TextMesh read the same
font in a later change.
