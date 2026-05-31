# 2D-UI Overlay Verification

Screenshots of the ld-58 UI scenes rendered through the 2D Control overlay
(viewport mode = 2D), captured by `scripts/showcase/verify-2d.mjs` against the
built web app. Regenerate after overlay changes:

```bash
pnpm --filter @textscene/web-previewer build
pnpm --filter @textscene/web-previewer preview --port 4173 &   # serve dist
node scripts/showcase/verify-2d.mjs                             # writes *-2d.png + verify-2d.json
```

`verify-2d.json` records per-scene objective stats (rendered control count,
unregistered-fallback count, distinct Control types, console errors) alongside
each screenshot.

These complement the deterministic, browser-free guard in
`packages/textscene-core/src/r3f/controls/ld58-ui-overlay.test.tsx`, which runs
the same scenes through the parse → SceneGraph → overlay pipeline in JSDOM.

## Known follow-ups (visible here)

- **Multiline quoted text** (e.g. StartScreen's two-line title) renders only its
  first line with a stray leading quote — the line-based property parser doesn't
  yet join quoted values that span lines.
