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
is 1,785,000 B. It replaces ADR-0055's 1,150,000 B, which held only the canvas-paint closure of the
split build.

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
- No check gates the web previewer's first-paint bundle size, and no check keeps modules loaded
  only on demand out of a first paint (#2078).
