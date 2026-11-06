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

## Fallbacks

The previewer models the re-imported state of a BMFont, in which its `fallbacks` import param names
fonts that have imported. A fresh import in the editor loses a raw-font fallback: the editor sorts
imports by import order, then by importer name (`editor_file_system.h:294-296`), so `font_data_bmfont`
runs before `font_data_dynamic`, and `ResourceImporterBMFont::import` loads the raw font before it has
an imported resource (`resource_importer_bmfont.cpp:98`). A second import keeps the fallback, and a
project that has been opened twice holds that state. A Label that falls back from a BMFont to a raw
font draws hex-code boxes in a fresh project and the fallback in a settled one.

## Consequences

A character the descriptor lacks draws a hex-code box, where Godot draws it from the font's
`fallbacks`. No font kind has a per-glyph fallback search yet.

A Label3D draws a BMFont with the same painter under its own rules (`glyphDrawer.ts`): it keeps the
pen, skips a glyph whose page rectangle is 2 px or less and draws no hex-code box
(`label_3d.cpp:333-360`). Its material multiplies the page by the modulate in linear. A TextMesh
reads no outlines from a BMFont (`bitmapFontOutlines.ts`), so it draws only the hex-code box of a
character the font lacks.
