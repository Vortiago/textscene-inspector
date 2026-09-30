/**
 * Walks up from a document's directory for `project.godot`, and falls back to the
 * workspace root, since Godot's `res://` is always project-root-relative. The
 * preview's `VSCodeResourceProvider`, `TscnDocumentLinkProvider` and the linter's
 * `LintResourceProvider` share it, so all agree on where a `res://` path points.
 * The walk itself is core's `findProjectRoot`, which the CLI shares.
 */

import * as vscode from 'vscode';
import { comparablePath, findProjectRoot, isWithinRoot } from '@textscene/core/resources/resPath';

/**
 * The directory above `dir`, or null at the top. Through `joinPath`, never
 * `Uri.file`, so a virtual workspace keeps its scheme.
 */
function parentUri(dir: vscode.Uri): vscode.Uri | null {
  const parent = vscode.Uri.joinPath(dir, '..');
  return parent.path === dir.path ? null : parent;
}

/** Whether the walk ends at a directory: the workspace root itself, or one outside it. */
function stopsAt(workspaceRoot: vscode.Uri): (dir: vscode.Uri) => boolean {
  const rootKey = comparablePath(workspaceRoot.fsPath);
  return (dir) => comparablePath(dir.fsPath) === rootKey || !isWithinRoot(workspaceRoot.fsPath, dir.fsPath);
}

async function hasProjectFile(dir: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.joinPath(dir, 'project.godot'));
    return true;
  } catch {
    // `stat` rejects for a missing file, which is the answer.
    return false;
  }
}

export async function findGodotProjectRoot(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri
): Promise<vscode.Uri> {
  const documentDir = vscode.Uri.joinPath(documentUri, '..');
  const root = await findProjectRoot(documentDir, parentUri, stopsAt(workspaceRoot), hasProjectFile);
  return root ?? workspaceRoot;
}
