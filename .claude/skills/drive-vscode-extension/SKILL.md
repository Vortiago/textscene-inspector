---
name: drive-vscode-extension
description: Drive the real VS Code extension host over CDP to screenshot the preview webview and verify what it paints. Use when asked to screenshot or demo the VS Code extension, to prove a feature actually renders in the extension (not just the web previewer), or to investigate the webview's CSP, offline behaviour or console errors.
---

# Driving the VS Code extension

The webview is a sandboxed `vscode-webview://` frame. The extension host cannot
see inside it, so `pnpm --filter textscene-inspector test:integration` proves
only that the panel loads and completes its handshake — never that a pixel
landed. **Ink** is the missing evidence: attach a debugger to the real VS Code,
walk into the frame, and count the pixels that differ from the background.

`scripts/vscode/driveScene.mjs` does the driving. Two callers sit on it:
`drive-vscode.mjs` (`pnpm drive:vscode`), the CLI for screenshots and one-off
measurements, and `webview-csp-gate.mjs` (`pnpm test:vscode:csp`), the automated
regression gate. This skill is how to use them and what they already know.

**Reach for the gate first when the question is "did text paint under the CSP".**
It answers that in one command with no eyeballing, and it is the thing CI runs.
Reach for the CLI when you need a picture, a custom `--eval`, or a scene the gate
does not drive.

## Steps

1. **Build what the dev-host loads.** `pnpm --filter textscene-inspector build`.
   `--extensionDevelopmentPath` loads `dist/`, and the webview bundle resolves
   `@textscene/core` through that package's `dist` too (its `prebuild` hook
   covers it). Done when `apps/textscene-vscode/dist/webview/webview.js` is
   newer than every source file you changed — a stale bundle silently
   screenshots old code.

2. **Drive a scene.** `pnpm drive:vscode <scene.tscn> [--out <dir>]` (add
   `--split` to keep the source editor beside the preview for a "this is VS
   Code" shot). Done when the run exits 0 and `<out>/report.json` has
   `"sizedCanvas": true`; artifacts are `workbench.png`, `webview.png`,
   `canvas.png` (the WebGL readback) and the report.

3. **Read the report before the pictures.** `inkPixels` per capture,
   `cspViolations`, `failedRequests`, `pageErrors`, and `requestHosts.webview` —
   the offline evidence, which holds only `file+.vscode-resource.vscode-cdn.net`
   when the preview touches no network. VS Code's own startup contributes two
   console errors of its own (a `marketplace.visualstudio.com` 404 as it looks
   the dev extension up in the gallery, and a built-in mermaid extension's
   API-proposal warning) plus `main.vscode-cdn.net` in the *workbench* bucket —
   ours are the ones logged from a `vscode-resource` URL. Done when every count
   is accounted for on one side of that line or the other.

4. **Attribute the ink.** Ink alone proves *something* painted. To pin it on one
   feature, drive two scenes differing in exactly that feature and diff them:
   `pnpm drive:vscode:diff <a.png> <b.png> --out diff.png`. Done when
   `diffPixels` is non-zero and its `bbox` sits where the feature belongs — and
   when the mask, eyeballed, shows the feature's shape and nothing else.

## The gate

`pnpm test:vscode:csp` drives two scenes, one launch each: `unit-label-2d.tscn`
verbatim, and its text-free twin — derived from that same file at run time by
emptying every `text = "…"`, never committed, so it cannot drift away from the
fixture. It then requires, per run: the preview opened via the contributed
command, a **sized** canvas (asserted separately, because a failed WebGL context
also reads back zero ink and must not look like "no glyphs"), a canvas that
settled (two byte-identical consecutive readbacks — the signal that replaces a
fixed sleep), and zero CSP violations, failed requests and console errors
**scoped to the webview frame**. Across the pair: ink ≥ 100 with text, exactly 0
without.

Scoping is the part to not get wrong. Page-wide counts are never zero — VS Code's
own startup contributes a marketplace 404 and `main.vscode-cdn.net`. `report.webview`
carries the filtered slice; assert on that, never on `report.cspViolations`.

Measured here, VS Code 1.131.0 / Linux / Xvfb, reproduced exactly across runs:
canvas 235x357, **252 ink with text, 0 without**, and the webview's only request
host is `file+.vscode-resource.vscode-cdn.net`. The gate runs no layout commands
(each `palette()` call is a fuzzy match that could invoke something else), so the
preview shares the editor area with the source document — hence the small canvas.
The floor (100) sits far below 252 on purpose: the canvas scales with whatever
virtual display the run gets, while the failure it guards takes ink to 0 on any
of them.

**Xvfb geometry is not reaching the server here.** Every `Xvfb` this machine
spawns runs `-screen 0 640x480x24` — the xvfb-run default — despite the driver's
`--server-args=-screen 0 1920x1080x24`, which `getopt` does parse. So VS Code's
window is clamped to 640x480 and the CLI baseline below (measured on a roomier
display) does not reproduce here. Pre-existing, unrelated to what the gate
asserts; investigate it before trusting any absolute pixel count from this
driver, and note the gate is built not to care.

`--skip-build` reuses the current `dist/`; without it the gate builds the
extension first, so a fresh checkout works on the first invocation.

## What the driver already handles

- **The VS Code binary** lives at
  `apps/textscene-vscode/.vscode-test/vscode-<platform>-<version>/code`. A
  `test:integration` run puts it there; the gate falls back to
  `downloadAndUnzipVSCode` into that same cache, so it needs no warm-up run. The
  CLI deliberately does not download — it fails fast and tells you to run the
  suite once, rather than stalling minutes on a typo'd path.
- **`xvfb-run`** wraps the launch whenever `--headed` is absent, and software GL
  is mandatory under it: without `--no-sandbox --disable-gpu-sandbox` plus
  `SWIFTSHADER_GL_ARGS` (from `scripts/showcase/browser.mjs`), every WebGL
  context creation fails with `BindToCurrentSequence failed`, the canvas stays
  at its unsized 300x150 default, and the run looks like a rendering bug.
- **`--disable-extensions` still loads the dev extension** — it disables only
  *installed* ones. Same combination the integration suite uses.
- **A throwaway `--user-data-dir`** with `workbench.startupEditor: none`,
  telemetry and update checks off. It also makes the Chat side-bar toggle
  deterministic (visible on every first launch). A caller can merge its own
  settings in (`settings:`) — the gate hides the secondary bar and activity bar
  that way rather than clicking for it.
- **Cleanup** is SIGKILL on the process group plus a `pkill` matched on the
  absolute user-data-dir. SIGTERM leaves orphaned renderers and an Xvfb behind,
  and the absolute path keeps a concurrent run in a sibling worktree safe.
- **The CDP port** defaults to 9444; concurrent runs need distinct `--port`.

## Finding the frame

Three frames, verified: the workbench at `vscode-file://vscode-app/…`, a webview
host at `vscode-webview://<uuid>/index.html?id=…`, and the extension's own
document at `vscode-webview://<uuid>/fake.html?id=…` inside it. Host and content
share one origin, so identify the content frame by its DOM — `#r3f-root` — and
treat an `evaluate` that throws as a detached or still-navigating frame.

## Reading pixels out of the frame

- `frame.evaluate` and `page.addInitScript` run through CDP, which is **not**
  subject to the page CSP. That is what lets you instrument a webview whose CSP
  is `default-src 'none'`.
- **`canvas.toDataURL` reads back blank unless `preserveDrawingBuffer` is on**,
  and three.js leaves it off. The driver forces it via an init script that
  patches `HTMLCanvasElement.prototype.getContext`; `--no-preserve-buffer`
  reproduces the false negative (measured: 0 ink from the readback while the
  compositor screenshot of the same run showed 318,858). When a readback is
  blank, the CDP screenshot is the ground truth — report that, rather than
  "nothing painted".
- Take the **largest** canvas: offscreen passes mount their own small ones.
- Forcing a fresh render from outside is a dead end: `canvas.__r3f` does not
  exist in @react-three/fiber v9, so there is no store to reach `gl.render` on.
  The `preserveDrawingBuffer` patch replaces it.

## Driving the workbench

- The renderer answers CDP well before the workbench lays out, and keystrokes
  sent in that window are swallowed — wait for `.monaco-workbench`, then settle.
- Prefer clicking the contributed editor-title action
  (`[aria-label*="Open Preview to the Side"]`) over the command palette: a click
  on a visible element opened the preview on every run here, where the palette
  is a quick-input widget that can decline to appear. The driver falls back to
  the palette, retries it four times, and records the winning path in
  `report.openedVia`.
- Toasts (git prompts, extension notices) float over the webview and land in the
  screenshot; the CLI clears them before capturing. The gate does not — they
  cannot reach the canvas readback, and every palette call it skips is one fewer
  fuzzy match that could fire the wrong command.

## The CSP

`apps/textscene-vscode/src/webview/webviewHtml.ts` is the single source of truth.
It grants `style-src`, `script-src` (nonce + `cspSource`) and
`img-src cspSource blob: data:` on a `default-src 'none'` base. Everything else
is denied by that base: no `connect-src` (no fetch/XHR/WebSocket, for `data:` and
`blob:` URLs too), no `worker-src` (no blob-URL worker), no `font-src` (no CSS
`@font-face`). Anything the webview must load therefore ships inside the bundle —
the MSDF glyph atlas rides in as a `data:` URI under `img-src data:`.

ADR-0037 holds why the text pipeline is a baked atlas rather than troika, and
which directives actually blocked it — read it before proposing a CSP widening.

## Measured baseline

The CLI's configuration — layout commands run, so the webview fills the editor
area. The gate's window is smaller and its numbers differ; see above.

`scenes/fixtures/unit-label-2d.tscn`, VS Code 1.131.0, Linux/Xvfb — repeated
runs reproduce these exactly: canvas readback 767x764 with **1275 opaque / 1497 ink** pixels;
webview screenshot 1092x808 with 318,858 ink. A copy of that scene with every
`text` emptied reads **0 ink** from the canvas and 317,595 from the screenshot,
and `ink-diff` puts the difference at 1497 pixels (canvas) / 1253 (screenshot),
bounded to the label rect and shaped like the words. Zero CSP violations, zero
failed requests, zero page errors. Glyphs paint, offline, under the real CSP.

## Related

`scripts/showcase/vscode/capture.mjs` drives the same dev-host for the
documentation screenshots (`docs/screenshots/vscode/`) and resolves a VS Code
binary across platforms. Reach for it when the goal is a pretty picture of
committed example scenes; reach for `drive-vscode.mjs` when the goal is a
number.

CI runs two VS Code jobs, both in `integration-tests`: the extension-host suite
on all three OSes, and `pnpm test:vscode:csp` on Linux only. The CLI and the
showcase capture do not run there. Linux-only is deliberate: this driver has been
exercised only under Xvfb, so its `--headed` path and the macOS/Windows window
and binary layouts are unverified.
