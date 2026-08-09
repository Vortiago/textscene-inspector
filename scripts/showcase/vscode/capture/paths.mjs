/**
 * Where the capture reads and writes, resolved once from the worktree the
 * command ran in so no module derives its own offset.
 */

const WT = process.cwd();

export const EXT = `${WT}/apps/textscene-vscode`;
// Open the committed example scenes as the workspace: self-contained .tscn with
// no .csproj/.cs, so the C# Dev Kit never activates and hijacks focus with its
// welcome page. Same scenes as the web showcase.
export const WS = `${WT}/scenes/examples`;
export const TMP = `${WT}/.tmp`;
export const UD = `${TMP}/vsc-showcase-ud`;
export const OUT = `${WT}/docs/screenshots/vscode`;
export const PORT = 9222;
// Reuse the VS Code the integration suite already downloads (pnpm --filter
// textscene-inspector test:integration caches here); avoids a redundant fetch.
export const VSCODE_CACHE = `${EXT}/.vscode-test`;
