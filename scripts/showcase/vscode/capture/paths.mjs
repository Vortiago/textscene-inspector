/**
 * Where the capture reads and writes, resolved once from the repo root, so a run from any
 * directory points `--extensionDevelopmentPath` at a real extension instead of writing
 * `TIMEOUT (no canvas)` shots and exiting 0.
 */

import { REPO_ROOT } from '../../../repoRoot.mjs';

export const EXT = `${REPO_ROOT}/apps/textscene-vscode`;
// The fixtures res:// root, which the web previewer mirrors, so `res://` resolves the same on both
// sides. It holds no .csproj or .cs, so the C# Dev Kit never activates and takes focus.
export const FIXTURES = `${REPO_ROOT}/scenes/fixtures`;
export const TMP = `${REPO_ROOT}/.tmp`;
// A throwaway copy, since the hot-reload and camera-survival shots rewrite a scene on disk. The
// leaf is named `fixtures`, so the Explorer header reads as the real directory in every shot.
export const WS = `${TMP}/vsc-shots-ws/fixtures`;
export const UD = `${TMP}/vsc-showcase-ud`;
export const OUT = `${REPO_ROOT}/docs/screenshots/vscode`;
// A sibling worktree's dev-host has another user-data-dir, survives `killStaleHost` and can
// answer here, so the port is overridable.
export const PORT = Number(process.env.VSCODE_CDP_PORT) || 9222;
// The VS Code that `pnpm --filter textscene-inspector test:integration` caches, which saves a fetch.
export const VSCODE_CACHE = `${EXT}/.vscode-test`;
