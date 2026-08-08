# Two text painters, one shaping engine

- Status: Accepted (2026-08-06).
- Related: ADR-0031 (Control nodes render natively in the canvas — this is how that
  decision's text gets drawn); ADR-0026 (comparison sheets live in their slice — the
  measured limitation below is recorded there as well as here).

## Context

Text in the native Control engine is painted from a **build-time MSDF atlas** baked
from one vendored font (Open Sans SemiBold, OFL-1.1). That choice is settled and
works: the atlas is byte-deterministic, scale-invariant, costs nothing at runtime, and
rides the lazy controls chunk at ~90.5 KB gzip for full printable ASCII. `Label3D`
draws through the same atlas, which is what removed the last host-font dependency from
the renderer — before that, a caption's pixels depended on which fonts the machine
running the preview happened to have installed.

A scene may also author **its own** font: a `Theme` `.tres` carrying `default_font`, or
a node's `font` / `theme_override_fonts/*`. Those arrive as arbitrary font bytes that
do not exist until a scene is opened, so no build-time bake can cover them.

The obvious move — generate an MSDF atlas at runtime for whichever font a scene
supplies — is **not available in the VS Code webview**. `webviewHtml.ts` sets
`default-src 'none'` with no `connect-src`, no `font-src` and no `worker-src`, so every
absent directive falls back to `'none'`. MSDF generation needs a worker, and a worker
is exactly what is blocked.

That constraint was measured under a mechanical replica of the production CSP, with a
negative control proving the harness was really enforcing it: the atlas path drew 3,918
opaque pixels across 13 glyphs with zero violations and **zero attempted network
requests**, while the alternative library candidate failed two independent ways —
`worker-src` blocked its blob-URL SDF worker, and `connect-src` blocked its font
*fetch* for `data:` and `blob:` URLs alike, so inlining the bytes could not help. That
second failure was isolated by relaxing exactly one directive: adding only
`connect-src blob:` flipped the same page from a timeout with no glyphs to 3,407 opaque
pixels. Enabling it in production would mean widening the extension's own CSP — a
security-posture change, not an implementation detail.

## Decision

Carry **two painters and exactly one shaping engine**.

- **Painter A — baked MSDF atlas.** The bundled default font. Unchanged.
- **Painter B — runtime `FontFace` + canvas-2D raster.** Scene-authored fonts.
  `new FontFace(name, arrayBuffer)` + `document.fonts.add`, rasterised to a texture.
  No fetch, no worker, no blob URL anywhere on the path — the only door this CSP leaves
  open.

Dispatch is **internal to `TextRun.tsx`**, on a `kind: 'atlas' | 'canvas'` discriminant
carried by the font metrics. No per-slice `Component.tsx` knows a second path exists.

### The invariant that makes this safe

**The split is in the painter only. Shaping is never duplicated.**

`textLayout.ts` — the port of Godot's `Label::_shape` and
`TextServer::shaped_text_get_line_breaks`, including the autowrap modes, the edge-space
trim defaults and the adaptive mid-word break — is parameterised over a `FontMetrics`
contract and shapes *both* paths. A scene font changes the metrics fed to one shaping
implementation; it does not get a shaping implementation of its own.

`FontMetrics` implementations supply **only raw design-unit data** (unitsPerEm, hhea
ascent/descent, per-glyph advances, kerning pairs). Every conversion to pixels lives
once, in `fontMetrics.ts`. In particular the line-pitch rule lives there: Godot reads
FreeType's *pixel-quantized* 26.6 size metrics, so ascent and descent are each
ceiling-rounded to a whole pixel **independently** and then summed — at Open Sans 16,
`ceil(18) + ceil(5) + 3 = 26`. An implementation that computed its own pitch from a raw
float sum would undershoot every line by ~1px, compounding down a multi-line label. It
is in the shared layer specifically so a second font cannot silently reimplement and
drop it.

## Considered options

- **Runtime MSDF generation.** Blocked by `worker-src 'none'`. Would require widening
  the extension CSP.
- **The troika/drei text stack.** Blocked twice over, as measured above. Also ~312 KB
  gzip against the atlas's ~90.5 KB.
- **Name a system font and let the host resolve it.** This is what the renderer used to
  do, and it is the defect this line of work removed: golden images differed by machine
  and a fixture's diff varied with which fonts were installed. Not revisitable.
- **Ignore scene fonts; render everything in the bundled default.** Cheapest, and
  wrong — a preview whose whole purpose is showing what Godot shows cannot silently
  substitute a different typeface.

## Consequences

- **The CSP claim is now guarded at the real origin, not only replicated.** The spike
  above ran in a plain headless page that reproduced the directives by hand; it never
  loaded at `vscode-webview://`. `pnpm test:vscode:csp` closes that: it opens the Control
  label fixture through the extension's own preview command in a real desktop VS Code and
  reads the canvas back over CDP, requiring ink from the glyph atlas, exactly zero ink
  from the same scene with every `text` emptied, and zero CSP violations, failed requests
  and console errors inside the preview frame. Dropping `data:` from `img-src` takes it
  from 252 ink pixels to 0 — on the reference display; the count scales with the window,
  the zero does not — with a violation naming the atlas. So a CSP edit, a bundler change
  or an asset-loading refactor that re-breaks this fails loudly instead of silently.
- **Scene fonts are not scale-invariant.** A canvas raster is resolution-dependent
  where an MSDF atlas is not. Acceptable: the 2D parity capture renders at zoom 1.
- **`.woff2` cannot be table-parsed in-browser.** The SFNT reader takes `head`/`hhea`
  straight from raw bytes and was validated against `fontkit` on all 27 corpus
  `.ttf`/`.otf` files at 100% match, but a `.woff2` is Brotli-compressed and
  `DecompressionStream` has no `brotli`. Those fall back to canvas
  `fontBoundingBoxAscent/Descent`, measured at a fixed 1000px reference size — at which
  a real corpus `.woff2` matched its true `hhea` values (950/250) **exactly**, while the
  same measurement at realistic 16px and 42px sizes drifted by up to 12.5 units because
  Chromium pixel-snaps small-size text metrics. The residual risk is disclosed rather
  than hidden: this is Chromium's bounding box, not FreeType's `hhea`, and a font whose
  author pads its bounding box beyond `hhea` would carry that padding in undetected.
  Two corpus fonts are affected; zero are plain `.woff`.
- **A font that fails to load renders in the bundled default, never nothing** — matching
  Godot's own fall back to the theme default, with a per-resource deduplicated
  `logger.warn` naming the node path. A `SystemFont` (OS family names) takes the same
  path: Godot considers it a valid resolution because the OS resolves it, so
  "resolved" and "usable" are kept as separate predicates rather than letting our
  limitation masquerade as Godot's behaviour.
- **Two paths is a real cost.** It is recorded here so the next reader finds a stated
  reason instead of what looks like drift, and does not "clean it up" by deleting the
  path the CSP requires.
