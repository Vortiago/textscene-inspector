# 2D-UI Overlay Verification

Screenshots of the synthetic Control-coverage target scenes (`example-ui-dialog`,
`unit-control-containers`, and the BBCode `RichTextLabel` demo) rendered through
the 2D Control overlay (viewport mode = 2D), captured by
`scripts/showcase/verify-2d.mjs` against the built web app. Regenerate after
overlay changes:

```bash
pnpm --filter @textscene/web-previewer build
pnpm --filter @textscene/web-previewer preview --port 4173 &   # serve dist
node scripts/showcase/verify-2d.mjs                             # writes *-2d.png + verify-2d.json
```

`verify-2d.json` records per-scene objective stats (rendered control count,
unregistered-fallback count, distinct Control types, console errors) alongside
each screenshot.

These complement the deterministic, browser-free guard in
`packages/textscene-core/src/r3f/controls/controls-ui-overlay.test.tsx`, which
runs the same scenes through the parse → SceneGraph → overlay pipeline in
JSDOM.

Multiline quoted text (a Label spanning two lines) renders in full: the parser
joins quoted values that span lines (`packages/textscene-core/src/parser/TscnParserCore.ts`,
guarded by `multilineStrings.test.ts`).
