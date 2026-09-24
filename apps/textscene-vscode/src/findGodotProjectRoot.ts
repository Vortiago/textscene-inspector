/**
 * Walks up from a document's directory for `project.godot`, and falls back to the
 * workspace root, since Godot's `res://` is always project-root-relative. The
 * preview's `VSCodeResourceProvider` and `TscnDocumentLinkProvider` share it, so
 * both agree on where a `res://` path points.
 */

import * as vscode from 'vscode';

function normalizeFsPath(fsPath: string): string {
  return fsPath.replace(/\\/g, '/').toLowerCase();
}

/**
 * Whether a normalized path sits strictly under the root. The separator makes it
 * a boundary: a bare `startsWith` walks `/home/u/proj-other` as if it were inside
 * `/home/u/proj`. A root that already ends in one gains no second.
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
      // Not found here: keep searching upward.
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
