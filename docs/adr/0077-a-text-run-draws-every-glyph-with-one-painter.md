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
- A colour glyph over an empty `glyf` entry (COLR v0 and v1 emoji) draws nothing. Godot draws its
  layers in their own colours (`text_server_adv.cpp:1286-1290`, `:4044-4046`). The browser drew a
  silhouette in the font colour, further from Godot by pixel count. #1876 ports Godot's colour glyph.
