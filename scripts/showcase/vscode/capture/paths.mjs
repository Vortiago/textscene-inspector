/**
 * Where the capture reads and writes, resolved once from the repo root so no
 * module derives its own offset — and so a run from any directory still points
 * `--extensionDevelopmentPath` at a real extension instead of writing
 * `TIMEOUT (no canvas)` shots and exiting 0.
 */

import { REPO_ROOT } from '../../../repoRoot.mjs';

export const EXT = `${REPO_ROOT}/apps/textscene-vscode`;
// The fixtures res:// root — the same directory the web previewer mirrors, so
// `res://` resolves identically on both sides. It holds self-contained .tscn
// with no .csproj/.cs, so the C# Dev Kit never activates and hijacks focus with
// its welcome page.
export const FIXTURES = `${REPO_ROOT}/scenes/fixtures`;
export const TMP = `${REPO_ROOT}/.tmp`;
// The dev-host opens a THROWAWAY COPY, never the tracked corpus: the hot-reload
// and camera-survival shots rewrite a scene on disk, and an aborted run must not
// leave a repo fixture edited. The leaf is named `fixtures` so the Explorer
// header reads the same in every shot as the directory the scenes really live in.
export const WS = `${TMP}/vsc-shots-ws/fixtures`;
export const UD = `${TMP}/vsc-showcase-ud`;
export const OUT = `${REPO_ROOT}/docs/screenshots/vscode`;
// A sibling worktree's dev-host survives `killStaleHost` by design (it carries a
// different user-data-dir) and keeps answering here, so the port is overridable.
export const PORT = Number(process.env.VSCODE_CDP_PORT) || 9222;
// Reuse the VS Code the integration suite already downloads (pnpm --filter
// textscene-inspector test:integration caches here); avoids a redundant fetch.
export const VSCODE_CACHE = `${EXT}/.vscode-test`;
