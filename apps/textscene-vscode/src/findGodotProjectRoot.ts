/**
 * Shared Godot project-root resolution: walk upward from a document's
 * directory looking for `project.godot`, stopping at (and falling back to)
 * the workspace root when none is found. `res://` is ALWAYS project-root-
 * relative in Godot (never relative to the current file), so a scene living
 * in a subfolder with no `project.godot` anywhere above it still resolves
 * `res://` against the workspace root rather than its own directory —
 * otherwise every shared asset (GLBs, textures) 404s.
 *
 * Shared by `VSCodeResourceProvider` (reads resource bytes for the preview
 * webview) and `TscnDocumentLinkProvider` (turns `res://` references into
 * clickable links) so both agree on exactly where a `res://` path points.
 */

import * as vscode from 'vscode';

function normalizeFsPath(fsPath: string): string {
  return fsPath.replace(/\\/g, '/').toLowerCase();
}

/**
 * Whether a normalized path sits strictly under the root.
 *
 * The separator is what makes it a boundary: a bare `startsWith` also accepts
 * every SIBLING whose path merely begins with the root's spelling, so a
 * document in `/home/u/proj-other` would be walked as if it were inside
 * `/home/u/proj`. A root that already ends in one must not gain a second.
 */
function isUnderRoot(rootNormalized: string, candidateNormalized: string): boolean {
  const prefix = rootNormalized.endsWith('/') ? rootNormalized : `${rootNormalized}/`;
  return candidateNormalized.startsWith(prefix);
}

export async function findGodotProjectRoot(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri
): Promise<vscode.Uri> {
  const workspaceRootNormalized = normalizeFsPath(workspaceRoot.fsPath);
  let currentDir = vscode.Uri.joinPath(documentUri, '..');

  while (true) {
    const currentPathNormalized = normalizeFsPath(currentDir.fsPath);
    const projectFile = vscode.Uri.joinPath(currentDir, 'project.godot');

    try {
      await vscode.workspace.fs.stat(projectFile);
      return currentDir;
    } catch {
      // Not found here — keep searching upward.
    }

    if (
      currentPathNormalized === workspaceRootNormalized ||
      !isUnderRoot(workspaceRootNormalized, currentPathNormalized)
    ) {
      return workspaceRoot;
    }

    currentDir = vscode.Uri.joinPath(currentDir, '..');
  }
}
