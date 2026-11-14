# The bundled font draws from its outlines, with no glyph atlas

- Status: Accepted. **Supersedes ADR-0040.**
- Amends: ADR-0037. Its section "Text: a vendored MSDF atlas, not troika" no longer holds. The
  rest of that decision stands.
- Related: ADR-0059 (project fonts), ADR-0064 (a BMFont draws its page images), ADR-0042 (the
  webview CSP).

## Context

Godot builds its default font as a `FontFile` from bytes the engine embeds
(`scene/theme/default_theme.cpp:1378-1388`). The font is not MSDF
(`servers/text/text_server.cpp:2386`), so FreeType fills each glyph from its hinted outline
(`modules/text_server_adv/text_server_adv.cpp:1360-1373`) and strokes each outline ring
(`:1383`).

ADR-0040 kept two painters for the bundled Open Sans SemiBold. Its amendments moved every caller
to the canvas painter, which draws FreeType's coverage of each outline. The baked MSDF atlas then
drew only where the page could not register the font as a `FontFace`. No supported host is such a
page: a `FontFace` built from bytes in hand passes the webview CSP.

The canvas painter did not need the `FontFace` either. It read each contour from the bundled
bytes, and asked the browser to draw only a glyph with no contour. No glyph of the bundled font
that has ink lacks a contour.

## Decision

**The bundled font is one face, read from its bytes, and one painter draws it.**

- The previewer ships the bytes of `OpenSans_SemiBold.woff2`, the metrics baked from them and the
  shaping tables. It ships no glyph atlas and registers no `FontFace` for the bundled font.
- A layout shapes with the bundled face (`FontMetrics.kind` `'bundled'`). `TextRun` draws that
  layout on the bundled canvas face: the same numbers, with the outlines of the font at the
  default font's hinting (`BundledCanvasRun.tsx`, `bundledCanvasFace.ts`).
- The kind stays apart from `'canvas'` because the two faces take their hinting from two places. A
  scene font carries the hinting of its import. The default font takes
  `gui/theme/default_font_hinting` from the project (`theme_db.cpp:56`, `default_theme.cpp:1383`),
  which a layout does not hold. So the run reads the setting and picks the outlines, and it waits
  for the project settings to load first.
- A run of the bundled face draws nothing while its outlines load, and counts as a pending load
  for that time. Outlines that cannot be read leave the run empty, with no pending load. The
  outline reader warns once.
- A canvas face with outlines asks nothing of the browser's text rasteriser (ADR-0077). A glyph
  with no contour draws as nothing. So the bundled font cannot draw in a host font.
- `FontMetrics.kind` is `'bundled' | 'canvas' | 'bitmap'`. A scene font stays `'canvas'` with its
  own `FontFace`, and a BMFont stays `'bitmap'` (ADR-0064).

What ADR-0040 decided for an outline stands: Label3D and every Control stroke the ring with the
port of `ftstroke.c`, and each ring is its own surface below the fill.

## The ink box

The canvas painter sizes the raster of a run from the ink of each glyph, and one rule gives that
ink for every font: the reach of what the paint draws for the glyph (`GlyphPainter.reachReader`,
ADR-0077).

- A glyph drawn from an outline reaches as far as the control box of its contours. The painter
  reads the contours it rasterises, so the box holds the size, the hinting, the shear, the embolden
  and the variation instance.
- A glyph the browser draws as text, which is a glyph of a face whose outlines the previewer cannot
  read, reaches as far as the ink `measureText` gives. It takes one ascent on each side where that
  ink is of another instance.
- A glyph with no contour on a face with outlines draws nothing, and spans its pen box.

No table holds an ink box for one font. The bundled font, a scene font and a fallback face all
take the first rule, in a Control run as in a Label3D.

## Considered options

- **Keep the atlas for a page with no `FontFace`.** No supported host is such a page, and the
  painter does not need a `FontFace`.
- **Register the bundled font as a `FontFace` and draw from that alone.** The browser's
  rasteriser does not match FreeType's coverage, and ADR-0040 measured that.
- **Bake an ink box for each glyph of the bundled font.** The atlas table held one, on a grid of
  42 steps per em with a pad of 2 steps. Such a table serves one font at its default instance, so
  a scene font and a Control run took other rules.

## Consequences

- The lazy controls chunk loses the atlas image, about 209 KB gzipped, and the MSDF shader.
- The bake needs `fontkit` and `wawoff2` only. `msdf-bmfont-xml` is no longer a dependency.
- Text is not scale invariant. The painter rasterises at the font size, as Godot caches a glyph
  at its font size (`label_3d.cpp:345-350`), so a magnified glyph blurs as Godot's does.
- The bundled face reads the glyph and the advance of every code point from its baked `cmap` and
  `hmtx` tables, as a scene font reads them from its file. No table of one character set stands
  beside them.
- The webview CSP needs no `img-src data:` for text. `pnpm test:vscode:csp` still guards that
  text draws at the real origin.
