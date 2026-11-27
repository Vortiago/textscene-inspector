# The VS Code webview loads one script file

- Status: Accepted.
- Related: ADR-0042 (the procedural-texture worker, which the script starts from a `blob:` URL).
- Amends: ADR-0055 (the webview bundle ceiling).

## Context

Desktop VS Code serves every file a webview fetches through the webview's service worker. Since
VS Code 1.130, that worker lets at most 32 response bodies from the host be open at one time
(`maxActiveHostResourceResponseBodies` in `src/vs/workbench/contrib/webview/browser/pre/service-worker.js`).
Every preview of the extension has the same webview origin, so all previews share the 32 places.

A preview that closes during its load keeps the places of its open requests. The worker frees a
place only when its request ends, and a request to a closed preview ends at the worker's 30 s
timeout (`resolveTimeout`). A request that finds no free place waits, and it gives no error.

The webview built with code splitting fetched 77 files at once on load. One preview closed during
its load took all 32 places, so every preview opened in the next 30 s loaded nothing, and a capture
ended at its 30 s load deadline (#2075).

## Decision

**The VS Code webview builds as one script file and one stylesheet.** The esbuild build of
`apps/textscene-vscode` sets `splitting: false`, so a dynamic `import()` in core is bundled into
`dist/webview/webview.js`. A preview closed during its load then holds at most two places.

`pnpm check:bundle-size` fails when the build writes a script beside `webview.js`, and when the
script is over its gzipped ceiling (`scripts/check-bundle-size/webviewBudget.mjs`). The ceiling
is 1,799,070 B. It replaces ADR-0055's 1,150,000 B, which held only the canvas-paint closure of the
split build. A change that outgrows the ceiling, with no shrink found, raises it by its measured growth:
the editor camera node (ADR-0091) added 1,820 B, the panels that read the scene through node
handles added 1,413 B, the Scene tree on node handles added 409 B, its review fixes added 685 B,
the inspector on node handles added 5,525 B, its review fixes added 266 B,
the scene failure field with its review fixes added 257 B, the reads of each place a
scene names a resource, as Godot 4.6.3 fails them, added 847 B, the scene failure on the
scene with Godot's line number and a per-view count of loads added 337 B, the order in
which Godot takes a file's headings with its review fixes added 170 B, the walk
of a file only the text reads with its review fixes added 142 B, one click travel, the
snapped Sprite2D edit rect and the remapped glTF materials added 487 B, their review fixes
added 278 B, a 2D pan and zoom with no scene render, the scene-render count and a pan press
the browser cannot turn into a text selection added 109 B, and reading a heading as
Godot's tag parser does added 1,325 B.

## Consequences

- The whole script loads on each preview open: about 1.78 MB gzipped, where the canvas-paint
  closure of the split build was about 1.07 MB. A local load of the two builds took the same time,
  about 0.5 s.
- A dynamic `import()` in core stays lazy in its evaluation, and the web previewer and the
  renderer package keep their own chunks.
- A cut-off copy of the script still fails its import, and the panel loads a new document once
  (`webviewLoadFailed`). No chunk can fail after the page runs.
- About 16 previews closed during their load within 30 s still fill the 32 places. Only VS Code can
  free a closed preview's places sooner (#2077).
- `check:bundle-size` is the guard, not an integration test. A test that fails on the split build
  needs about 10 previews closed during their load, and these hold places that the suites around
  it need for 30 s.
- The web previewer keeps its chunks, so `pnpm check:bundle-size:web` guards its first paint
  (`scripts/check-bundle-size/webFirstPaint.mjs`): the entry scripts and their static imports. It
  fails when they hold a module loaded only on demand, that is a dynamic `import()` target or a
  module no static import from the entry reaches. The web previewer job checks this for the dev
  edition, and `pnpm build:pages` checks it for the public edition. Only the public edition also
  fails over a gzipped ceiling, 1,301,407 B, which a change raises by its measured growth as above.
  The 2D pan and zoom with no scene render and the scene-render count added 62 B to it, and reading a heading as Godot's tag parser does added 2,032 B.
  The dev first paint holds the generated fixture manifest, which grows with each fixture. The three.js chunk holds only the three.js build, so
  the addons a dynamic `import()` reaches stay out of it.
