# A text run draws every glyph with one painter

- Status: Accepted.
- Amends: ADR-0040 (painter B), ADR-0069 (the ink box).
- Related: ADR-0075 (the previewer renders any Godot project a user opens).

## Context

Godot draws each glyph of a run through FreeType. A glyph whose bitmap is empty has no texture, and
Godot draws nothing for it (`modules/text_server_adv/text_server_adv.cpp:4042`). A character no
font has draws as a hex-code box, which the run draws as quads apart from its glyphs.

The canvas painter read the contours of each glyph, and gave a glyph with no contour to the
browser's `fillText`. One null meant two things: "the face has no outlines" and "this glyph has
no contour". So one raster could mix FreeType's coverage with the browser's hinting and
anti-aliasing, and a glyph with no contour could draw in a host font.

## Decision

**A canvas text run takes one glyph painter, by its face, and every glyph of the run draws with
it** (`GlyphPainter` in `glyphPainter.ts`).

- A face with outlines takes the outline painter (`outlineGlyphPainter.ts`). Each glyph draws as
  FreeType's bitmap of its contour or of its ring. A glyph with no contour draws nothing. The
  painter makes no 2D context.
- A face whose outlines the previewer cannot read (`outlines` null or absent) takes the browser
  text painter (`browserTextPainter.ts`). Each glyph draws with `fillText` or `strokeText` in the
  family of its `FontFace`. It is the only file that calls them.
- A face with neither readable outlines nor a `FontFace` takes the blank painter
  (`blankGlyphPainter.ts`): the bundled face while its outlines load. It draws nothing, as
  `fillText` would paint a host font for an unregistered family.
- The painter also reads the reach of each glyph, which sizes the raster, and the rectangle of the
  quad Godot draws for it. A run reads all three from the one painter.

## Consequences

- A user's font draws in its own glyphs or not at all, wherever the previewer reads its outlines.
- A font whose outlines the previewer cannot read still draws in the browser, with the browser's
  hinting and anti-aliasing. The notes of ADR-0040 on Skia and the canvas stroke hold for it.
- A glyph with a colour form draws it in the fill pass, in the order FreeType loads it
  (`ttgload.c:2385-2540`): the strike's bitmap, then the `SVG ` document, then the `COLR` v0 layers
  (`ftobjs.c:4743-4810`), then the contour. The auto-hinter's load takes the `SVG ` document before
  the strike (`ftobjs.c:1019-1050`). A `COLR` v1 glyph draws its contour, as `FT_Render_Glyph`
  blends v0 layers only. The outline pass loads no colour (`text_server_adv.cpp:1286-1290`), so it
  strokes the contour.
- A `CBDT` or `sbix` face is a bitmap face, as FreeType makes it (`sfobjs.c:903-906,1103-1110`): a
  glyph its strike lacks, and its outline pass, draw nothing.
- The browser draws an `SVG ` glyph's document, at the size and corner Godot's ThorVG hook gives it
  (`thorvg_svg_in_ot.cpp:218-300`). The draw is async: the glyph draws nothing until its bitmap
  lands, and the run then paints again. A shape's rim differs from ThorVG's by the browser's
  antialiasing. #1884 owns ThorVG's raster.
