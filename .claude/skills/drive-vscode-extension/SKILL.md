---
name: drive-vscode-extension
description: Drive the real VS Code extension host over CDP to screenshot the preview webview and verify what it paints. Use when asked to screenshot or demo the VS Code extension, to prove a feature actually renders in the extension (not just the web previewer), or to investigate the webview's CSP, offline behaviour or console errors.
---

# Driving the VS Code extension

The driver attaches a debugger to a real VS Code, walks into the preview webview and counts **ink**: the pixels that differ from the background. The webview is a sandboxed `vscode-webview://` frame that the extension host cannot see into. So `pnpm --filter textscene-inspector test:integration` proves only that the panel loads and completes its handshake, never that a pixel painted.

`scripts/vscode/driveScene.mjs` does the driving. It has two callers:
- `drive-vscode.mjs` (`pnpm drive:vscode`): the CLI for screenshots and one-off measurements.
- `webview-csp-gate.mjs` (`pnpm test:vscode:csp`): the regression gate that CI runs.

If the question is "did text paint under the CSP", use the gate: it answers in one command with no eyeballing. Use the CLI for a picture, a custom `--eval` or a scene the gate does not drive.

## Steps

1. **Build what the dev host loads.** `pnpm --filter textscene-inspector build`.
   `--extensionDevelopmentPath` loads `dist/`, and the webview bundle resolves
   `@textscene/core` through that package's `dist` too (its `prebuild` hook
   builds it). Done when `apps/textscene-vscode/dist/webview/webview.js` is
   newer than every source file you changed. A stale bundle screenshots old
   code with no warning.

2. **Drive a scene.** `pnpm drive:vscode <scene.tscn> [--out <dir>]`. Add
   `--split` to keep the source editor beside the preview. Done when the run
   exits 0 and `<out>/report.json` has `"sizedCanvas": true`. The outputs are
   `workbench.png`, `webview.png`, `canvas.png` (the WebGL readback) and the
   report.

3. **Read the report before the pictures.** Read `inkPixels` per capture,
   `cspViolations`, `failedRequests`, `pageErrors` and `requestHosts.webview`.
   `requestHosts.webview` is the offline evidence: it holds only
   `file+.vscode-resource.vscode-cdn.net` when the preview touches no network.
   VS Code's own startup adds two console errors (a
   `marketplace.visualstudio.com` 404 for the dev extension, and a built-in
   mermaid extension's API-proposal warning) and `main.vscode-cdn.net` in the
   *workbench* bucket. Ours are the ones logged from a `vscode-resource` URL.
   Done when you can assign every count to one side or the other.

4. **Attribute the ink.** Ink alone proves only that *something* painted. Drive
   two scenes that differ in one feature and diff them:
   `pnpm drive:vscode:diff <a.png> <b.png> --out diff.png`. Done when
   `diffPixels` is non-zero, its `bbox` sits where the feature belongs, and the
   mask shows the feature's shape and nothing else.

## The gate

`pnpm test:vscode:csp` drives two scenes, one launch each: `unit-label-2d.tscn`
as committed, and a text-free twin. The gate derives the twin at run time by
emptying every `text = "…"`, so it cannot drift from the fixture.

Each run must show:
- The preview opened through the contributed command.
- A **sized** canvas. A failed WebGL context also reads back zero ink, so the gate asserts size separately.
- A settled canvas: two byte-identical readbacks in a row, in place of a fixed sleep.
- Zero CSP violations, failed requests and console errors **in the webview frame**.

Across the pair, ink is ≥ 100 with text and exactly 0 without. On VS Code 1.131.0, Linux and Xvfb, the gate measures a 235x357 canvas with 252 ink with text and 0 without, identical across runs, and the webview's only request host is `file+.vscode-resource.vscode-cdn.net`. The canvas scales with the virtual display, so the floor of 100 sits far below 252. The failure it guards takes ink to 0 on any display.

Assert on `report.webview`, the slice filtered to the webview frame, never on `report.cspViolations`. Page-wide counts are never zero, because VS Code's startup adds a marketplace 404 and `main.vscode-cdn.net`.

The gate runs no layout commands, because each `palette()` call is a fuzzy match that can invoke another command. So the preview shares the editor area with the source document, and the canvas is small.

`--skip-build` reuses the current `dist/`. Without it, the gate builds the extension first.

**Xvfb geometry does not reach the server on this machine.** Every `Xvfb` runs `-screen 0 640x480x24`, the xvfb-run default, despite the driver's `--server-args=-screen 0 1920x1080x24`. VS Code's window is clamped to 640x480, so the CLI baseline below does not reproduce here. Investigate this before you trust an absolute pixel count from the driver. The gate does not depend on it.

## What the driver handles

- **The VS Code binary** is at
  `apps/textscene-vscode/.vscode-test/vscode-<platform>-<version>/code`. A
  `test:integration` run puts it there. The gate falls back to
  `downloadAndUnzipVSCode` into the same cache. The CLI does not download: it
  fails fast and tells you to run the suite once.
- **`xvfb-run`** wraps the launch when `--headed` is absent. Software GL is
  mandatory under it: without `--no-sandbox --disable-gpu-sandbox` and
  `SWIFTSHADER_GL_ARGS` (from `scripts/showcase/browser.mjs`), every WebGL
  context fails with `BindToCurrentSequence failed`, and the canvas stays at its
  unsized 300x150 default. That looks like a rendering bug.
- **`--disable-extensions` still loads the dev extension.** It disables only
  installed extensions. The integration suite uses the same flags.
- **A throwaway `--user-data-dir`** with `workbench.startupEditor: none` and
  telemetry and update checks off. It also makes the Chat side-bar toggle
  deterministic (visible on every first launch). A caller can merge its own
  settings (`settings:`). The gate hides the secondary bar and the activity bar
  that way instead of clicking.
- **Cleanup** sends SIGKILL to the process group and runs `pkill` on the
  absolute user-data-dir. SIGTERM leaves orphaned renderers and an Xvfb. The
  absolute path keeps a concurrent run in a sibling worktree safe.
- **The CDP port** is 9444 by default. Concurrent runs need distinct `--port` values.

## Finding the frame

There are three frames: the workbench at `vscode-file://vscode-app/…`, a webview
host at `vscode-webview://<uuid>/index.html?id=…`, and the extension's document
at `vscode-webview://<uuid>/fake.html?id=…` inside it. Host and content share one
origin, so find the content frame by its DOM (`#r3f-root`). An `evaluate` that
throws means a detached or navigating frame.

## Reading pixels from the frame

- `frame.evaluate` and `page.addInitScript` run through CDP, which the page CSP
  does not govern. That lets you instrument a webview whose CSP is
  `default-src 'none'`.
- **`canvas.toDataURL` reads back blank unless `preserveDrawingBuffer` is on**,
  and three.js leaves it off. The driver forces it with an init script that
  patches `HTMLCanvasElement.prototype.getContext`. `--no-preserve-buffer`
  reproduces the false negative: 0 ink from the readback while the compositor
  screenshot of the same run shows the scene. When a readback is blank, the
  CDP screenshot is the ground truth. Report that, not "nothing painted".
- Take the **largest** canvas. Offscreen passes mount their own small ones.
- You cannot force a render from outside: `canvas.__r3f` does not exist in
  @react-three/fiber v9, so no store reaches `gl.render`. The
  `preserveDrawingBuffer` patch makes that unnecessary.

## Driving the workbench

- The renderer answers CDP before the workbench lays out, and it drops
  keystrokes sent in that window. Wait for `.monaco-workbench`, then settle.
- Click the contributed editor-title action
  (`[aria-label*="Open Preview to the Side"]`) before you try the command
  palette. A click on a visible element opens the preview reliably. The palette
  is a quick-input widget that can fail to appear. The driver falls back to the
  palette, tries it four times, and records the path that worked in
  `report.openedVia`.
- Toasts (git prompts, extension notices) float over the webview and show in the
  screenshot. The CLI clears them before capture. The gate does not: they cannot
  reach the canvas readback, and each palette call it skips is one less fuzzy
  match that can fire the wrong command.

## The CSP

`apps/textscene-vscode/src/webview/webviewHtml.ts` is the single source of truth.
It grants `style-src`, `script-src` (nonce + `cspSource`) and
`img-src cspSource blob: data:` on a `default-src 'none'` base. The base denies
everything else: no `connect-src` (no fetch, XHR or WebSocket, for `data:` and
`blob:` URLs too), no `worker-src` (no blob-URL worker), no `font-src` (no CSS
`@font-face`). So everything the webview loads ships inside the bundle. The
MSDF glyph atlas arrives as a `data:` URI under `img-src data:`.

ADR-0037 records why the text pipeline is a baked atlas and not troika, and
which directives blocked troika. Read it before you propose a wider CSP.

## Measured baseline

This is the CLI's configuration: layout commands run, so the webview fills the
editor area. The gate's window is smaller, and its numbers differ.

`scenes/fixtures/unit-label-2d.tscn`, VS Code 1.131.0, Linux/Xvfb, identical
across runs: canvas readback 767x764 with **1275 opaque / 1497 ink** pixels,
webview screenshot 1092x808 with 318,858 ink. With every `text` emptied, the
canvas reads **0 ink** and the screenshot 317,595. `ink-diff` puts the
difference at 1497 pixels (canvas) and 1253 (screenshot), inside the label
rectangle and shaped like the words. Zero CSP violations, failed requests and
page errors.

## Related

`scripts/showcase/vscode/capture.mjs` drives the same dev host for the
documentation screenshots (`docs/screenshots/vscode/`) and finds a VS Code
binary on each platform. Use it for a picture of committed example scenes. Use
`drive-vscode.mjs` for a number.

CI runs two VS Code jobs, both in `integration-tests`: the extension-host suite
on all three operating systems, and `pnpm test:vscode:csp` on Linux only. The
CLI and the showcase capture do not run in CI. The gate is Linux-only because
the driver is verified only under Xvfb: its `--headed` path and the macOS and
Windows window and binary layouts are unverified.
