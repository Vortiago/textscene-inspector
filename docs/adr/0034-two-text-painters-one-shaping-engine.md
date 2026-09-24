# Two text painters, one shaping engine

- Status: Superseded by ADR-0040: the painter follows Godot's own glyph path, not the
  font's provenance. ADR-0040 keeps what the two painters are, why the second one exists
  and the CSP measurement that forbids the obvious alternative. It corrects the
  organising principle. Godot's default project font is not MSDF
  (`servers/text/text_server.cpp:2386`), so the engine rasterises it through FreeType and
  strokes a real contour annulus for an outline, which the baked field cannot represent.
  `Label3D` therefore paints through the raster painter with the same bundled font, which
  a split by provenance cannot express. Two parts of this ADR stand:
  - The bundled font removes the host-font dependency from the renderer. It is registered
    through `document.fonts` and painted by name, and painting waits until that
    resolves, because an unregistered family rasterises a system font silently.
  - The scale-invariance consequence holds for scene fonts only ("the 2D parity capture
    renders at zoom 1"). It does not cover a 3D billboard. ADR-0040 states that trade.
- Related: ADR-0037 (Control nodes render natively in the canvas: this is how that
  decision's text is drawn), ADR-0026 (comparison sheets live in their slice: the
  measured limitation below is recorded there too).

## Context

Text in the native Control engine is painted from a **build-time MSDF atlas** baked from
one vendored font (Open Sans SemiBold, OFL-1.1). The atlas is byte-deterministic and
scale-invariant, costs nothing at runtime, and rides the lazy controls chunk at ~90.5 KB
gzip for full printable ASCII. A caption's pixels therefore do not depend on the fonts
installed on the machine that runs the preview.

A scene may also author **its own** font: a `Theme` `.tres` that carries `default_font`,
or a node's `font` / `theme_override_fonts/*`. Those arrive as arbitrary font bytes that
do not exist until a scene opens, so no build-time bake can cover them.

The obvious move, to generate an MSDF atlas at runtime for the font a scene supplies, is
**not available in the VS Code webview**. `webviewHtml.ts` sets `default-src 'none'` with
no `connect-src`, no `font-src` and no `worker-src`, so each absent directive falls back
to `'none'`. MSDF generation needs a worker, and the CSP blocks workers.

This is measured under a replica of the production CSP, with a negative control that
proves the harness enforces it. The atlas path drew 3,918 opaque pixels across 13 glyphs
with zero violations and **zero attempted network requests**. The alternative library
failed two independent ways: `worker-src` blocked its blob-URL SDF worker, and
`connect-src` blocked its font *fetch* for `data:` and `blob:` URLs alike, so inlined
bytes cannot help. Relaxing one directive isolates the second failure: `connect-src blob:`
alone turns the same page from a timeout with no glyphs to 3,407 opaque pixels. To enable
it in production means widening the extension's own CSP, a change of security posture.

## Decision

Carry **two painters and exactly one shaping engine**.

- **Painter A: baked MSDF atlas.** The bundled default font.
- **Painter B: runtime `FontFace` + canvas-2D raster.** Scene-authored fonts.
  `new FontFace(name, arrayBuffer)` + `document.fonts.add`, rasterised to a texture. No
  fetch, no worker and no blob URL on the path: the only door this CSP leaves open.

Dispatch is **internal to `TextRun.tsx`**, on a `kind: 'atlas' | 'canvas'` discriminant
that the font metrics carry. No per-slice `Component.tsx` knows a second path exists.

### The invariant that makes this safe

**The split is in the painter only. Shaping is never duplicated.**

`textLayout.ts`, the port of Godot's `Label::_shape` and
`TextServer::shaped_text_get_line_breaks` (with the autowrap modes, the edge-space trim
defaults and the adaptive mid-word break), is parameterised over a `FontMetrics` contract
and shapes both paths. A scene font changes the metrics fed to one shaping
implementation. It does not get a shaping implementation of its own.

`FontMetrics` implementations supply **only raw design-unit data** (unitsPerEm, hhea
ascent/descent, per-glyph advances, kerning pairs). Each conversion to pixels lives once,
in `fontMetrics.ts`. The line-pitch rule lives there in particular: Godot reads
FreeType's *pixel-quantised* 26.6 size metrics, so ascent and descent are each
ceiling-rounded to a whole pixel **independently** and then summed. At Open Sans 16,
`ceil(18) + ceil(5) + 3 = 26`. A pitch from a raw float sum undershoots each line by
~1px, compounding down a multi-line label. The rule is in the shared layer so that a
second font cannot reimplement it and drop it.

## Considered options

- **Runtime MSDF generation.** Blocked by `worker-src 'none'`. It needs a wider extension
  CSP.
- **The troika/drei text stack.** Blocked twice, as measured above. Also ~312 KB gzip
  against the atlas's ~90.5 KB.
- **Name a system font and let the host resolve it.** Golden images then differ by
  machine, and a fixture's diff varies with the installed fonts. Not revisitable.
- **Ignore scene fonts and render everything in the bundled default.** Cheapest, and
  wrong: a preview whose purpose is to show what Godot shows cannot silently substitute a
  different typeface.

## Consequences

- **A gate checks the CSP claim at the real origin.** `pnpm test:vscode:csp` opens the
  Control label fixture through the extension's own preview command in a real desktop VS
  Code and reads the canvas back over CDP. It requires ink from the glyph atlas, exactly
  zero ink from the same scene with each `text` emptied, and zero CSP violations, failed
  requests and console errors inside the preview frame. To drop `data:` from `img-src`
  takes it from 252 ink pixels to 0 on the reference display (the count scales with the
  window, the zero does not), with a violation that names the atlas. So a CSP edit, a
  bundler change or an asset-loading refactor that breaks this fails loudly.
- **Scene fonts are not scale-invariant.** A canvas raster is resolution-dependent where
  an MSDF atlas is not. Acceptable: the 2D parity capture renders at zoom 1.
- **`.woff2` cannot be table-parsed in the browser.** The SFNT reader takes
  `head`/`hhea` from raw bytes, validated against `fontkit` on the corpus `.ttf`/`.otf`
  files at 100% match. But a `.woff2` is Brotli-compressed, and `DecompressionStream`
  has no `brotli`. Those fall back to canvas `fontBoundingBoxAscent/Descent`, measured at
  a fixed 1000px reference size. At that size a real corpus `.woff2` matches its true
  `hhea` values (950/250) **exactly**, while at 16px and 42px the same measurement drifts
  by up to 12.5 units, because Chromium pixel-snaps small-size text metrics. The residual
  risk: this is Chromium's bounding box, not FreeType's `hhea`, and a font whose author
  pads its bounding box beyond `hhea` carries that padding in undetected.
- **A font that fails to load renders in the bundled default, never nothing.** This
  matches Godot's own fallback to the theme default, with a per-resource deduplicated
  `logger.warn` that names the node path. A `SystemFont` (OS family names) takes the same
  path. Godot considers it a valid resolution because the OS resolves it, so "resolved"
  and "usable" are separate predicates, and the previewer's limitation does not pass as
  Godot's behaviour.
- **Two paths is a real cost.** Do not delete the path the CSP requires to "clean it up".
