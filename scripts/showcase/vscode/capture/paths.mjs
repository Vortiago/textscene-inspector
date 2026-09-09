/**
 * Where the capture reads and writes, resolved once from the repo root so no
 * module derives its own offset — and so a run from any directory still points
 * `--extensionDevelopmentPath` at a real extension instead of writing
 * `TIMEOUT (no canvas)` shots and exiting 0.
 */

import { REPO_ROOT } from '../../../repoRoot.mjs';

export const EXT = `${REPO_ROOT}/apps/textscene-vscode`;
// Open the committed example scenes as the workspace: self-contained .tscn with
// no .csproj/.cs, so the C# Dev Kit never activates and hijacks focus with its
// welcome page. Same scenes as the web showcase.
export const WS = `${REPO_ROOT}/scenes/examples`;
export const TMP = `${REPO_ROOT}/.tmp`;
export const UD = `${TMP}/vsc-showcase-ud`;
export const OUT = `${REPO_ROOT}/docs/screenshots/vscode`;
// A sibling worktree's dev-host survives `killStaleHost` by design (it carries a
// different user-data-dir) and keeps answering here, so the port is overridable.
export const PORT = Number(process.env.VSCODE_CDP_PORT) || 9222;
// Reuse the VS Code the integration suite already downloads (pnpm --filter
// textscene-inspector test:integration caches here); avoids a redundant fetch.
export const VSCODE_CACHE = `${EXT}/.vscode-test`;
