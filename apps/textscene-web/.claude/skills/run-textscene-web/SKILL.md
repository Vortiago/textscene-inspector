---
name: run-textscene-web
description: Run, start, build and drive the TextScene web previewer headless, open a .tscn fixture or upload a scene, select outliner nodes, read the inspector and take screenshots. Use when asked to run or screenshot the web previewer, to prove a change renders in the real app, or to check a scene for console errors.
---

# Run the web previewer

The web previewer is a Vite and React app that renders Godot `.tscn` files with react-three-fiber.
`driver.mjs` drives it. The driver builds `dist/`, serves it with `vite preview` on port 4339 and
opens one fixture in headless Chromium with SwiftShader WebGL. It writes screenshots and a JSON
report, then stops the server.

Paths here are relative to `apps/textscene-web/`. The repo root is `../..`.

## Prerequisites

- Node 24 (`.nvmrc`). If the machine has an older Node, run every command through
  `pnpm --config.use-node-version=24.11.1`. That flag downloads Node 24 into the pnpm home.
- No apt package. The driver uses Playwright's bundled Chromium, not a system Chrome.

```bash
pnpm install --frozen-lockfile
pnpm -w playwright:install
```

## Build

The driver builds `dist/` itself on each run (about 35 s). To build alone:

```bash
pnpm --filter @textscene/web-previewer build
```

`prebuild` builds `@textscene/core` and stages `scenes/` into `public/fixtures/`. After a core edit,
this one command rebuilds both.

## Run (agent path): the driver

```bash
pnpm exec node .claude/skills/run-textscene-web/driver.mjs unit-box-mesh.tscn \
  --select Root/Title --out /tmp/run-web
```

Set `VISUAL_SKIP_BUILD=1` to reuse `dist/`. The driver still refuses a `dist/` older than its
sources, and names the file.

Flags:

| Flag | Effect |
|---|---|
| `<fixture.tscn>` | The scene to open. The name must match `src/fixtures.ts` exactly. |
| `--select <nodePath>` | Clicks the outliner row, then screenshots the page and reads the inspector. Repeatable. |
| `--upload <file>` | Picks the file in the toolbar's file input after the fixture opens. Repeat it for the scene and its textures. |
| `--camera <path>` | Opens through that Camera3D (`?camera=`), for example `Root/Camera3D`. |
| `--eval <js>` | Evaluates one expression in the page and reports its value. |
| `--out <dir>` | The output directory. The default is `run-textscene-web` in the system temp directory. |

Outputs in `--out`:

- `canvas.png`: the settled WebGL canvas. The floating viewport toolbar is in it.
- `page.png`: the whole app, with the source pane, the outliner and the inspector.
- `select-<n>.png`: the whole app after the nth `--select`.
- `report.json`, also printed: `url`, `stage` (`3d` or `2d`), `ink` (from `inkStats`, `inkPixels`
  is the drawn area), `reason` (why no frame settled, or null), `outline` (every node path),
  `selections[].inspector`, `eval` and `diagnostics` (console errors and warnings, page errors and
  failed requests).

Look at the PNG files. A report with `reason: null` and empty `consoleErrors` and `pageErrors` is a
healthy load.

Upload a scene that is not in the fixture list. The uploaded scene replaces the opened fixture.
Add `--upload` for each texture. The app matches a texture to its `res://` path by file name.

```bash
pnpm exec node .claude/skills/run-textscene-web/driver.mjs unit-box-mesh.tscn \
  --upload ../../scenes/upload-payloads/child.tscn --select Child/ChildMesh --out /tmp/run-upload
```

Open a scene through its own camera:

```bash
pnpm exec node .claude/skills/run-textscene-web/driver.mjs unit-camera-attributes-exposure-camera.tscn \
  --camera Root/Camera3D --out /tmp/run-camera
```

## Direct invocation: core changes

Most pull requests change a node slice in `packages/textscene-core`, not the web UI. Test the slice
and lint a scene before you drive the app. `-w exec` runs vitest at the repo root, so its path starts
there.

```bash
pnpm --config.use-node-version=24.11.1 -w exec vitest run --project textscene-core packages/textscene-core/src/nodes/2d/sprite2d
pnpm --filter @textscene/linter build
node ../textscene-linter/bin/tscn-lint.js ../../scenes/fixtures/edge-animation-library-missing-subresource.tscn
```

The linter exits 1 when a scene has an error.

To parse a scene in plain Node, build `@textscene/tscn` and import its `dist/`:

```bash
pnpm --filter @textscene/tscn build
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { TscnParser } from "../textscene-tscn/dist/index.js";
const scene = new TscnParser().parse(readFileSync("../../scenes/fixtures/unit-box-mesh.tscn", "utf8"));
const walk = (n, path) => [`${path}${n.name} (${n.type})`, ...(n.children ?? []).flatMap((c) => walk(c, `${path}${n.name}/`))];
console.log(scene.nodes.flatMap((n) => walk(n, "")).join("\n"));
'
```

## Test

```bash
pnpm --filter @textscene/web-previewer test
VISUAL_SKIP_BUILD=1 pnpm -w test:e2e:web
```

The first runs the unit tests under happy-dom. The second is the end-to-end gate on port 4329. It
ends with `[gate] PASSED`. Run the gate alone. It measures long tasks, and it failed once beside a
driver run, then passed twice alone.

## Run (human path)

```bash
pnpm dev
```

Vite serves on port 3000, or the next free port, and tries to open a browser window. Headless, the
window is no use. Stop it with Ctrl-C.

## Gotchas

- Run the driver through `pnpm exec node`, not plain `node`. A pnpm wrapper can move the Playwright
  browser cache (`PLAYWRIGHT_BROWSERS_PATH`). Plain `node` then looks in `~/.cache/ms-playwright`
  and misses the browser that `pnpm playwright:install` downloaded.
- On a host with a GPU, the driver's Chromium renders WebGL on that GPU, not on SwiftShader.
  `pnpm test:gpu` reports it as `the golden launch reports ... expected SwiftShader`. A screenshot
  is then right for a review, but its pixels can differ from a CI golden. Use `pnpm test:visual`
  for a golden.
- An unknown fixture name does not 404. The app opens the stored or default scene, and the driver
  throws `previewer opened "<other>" but "<name>" was requested`. Run `pnpm generate:fixtures` from
  the repo root after you add a scene.
- After `--upload`, the URL loses `?fixture=`. The outliner and the screenshots show the uploaded
  scene.
- The driver settles the WebGL canvas, not the 2D parity frame. The parity frame refuses the app's
  default layout with `2D frame origin ... is not on a whole pixel`. Use `pnpm ref:godot` or the
  visual harness to measure against Godot.
- A uniform `canvas.png` is never written. The driver throws instead, as a lost WebGL context or an
  unrendered scene gives a uniform frame.
- `pnpm dev` takes the next free port when 3000 is busy. Read the `Local:` line for the port.
- Core's `dist/` does not load in plain Node, because its imports have no file extension. Import
  the parser from `@textscene/tscn`, not from `@textscene/core/parser`.
- Every run logs one warning: `THREE.Clock: This module has been deprecated`. It is not from your
  change.
- For the VS Code extension, use the `drive-vscode-extension` skill.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Executable doesn't exist at .../chromium_headless_shell-1248/...` | Run `pnpm -w playwright:install`. Run the driver through `pnpm exec node`. |
| Core component tests fail with `SyntaxError: Cannot use import statement outside a module` in `three.cjs` | Node is older than 24. Add `--config.use-node-version=24.11.1` to the pnpm command. |
| `[preview] dist/ predates <file>` | Run without `VISUAL_SKIP_BUILD`, or run the build command. |
| `port 4339 is in use` | Stop the other run, or set `RUN_WEB_PORT`. |
