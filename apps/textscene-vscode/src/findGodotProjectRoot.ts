/**
 * Walks up from a document's directory for `project.godot`, since Godot's `res://`
 * is always project-root-relative. The preview's `VSCodeResourceProvider` and
 * `TscnDocumentLinkProvider` fall back to the workspace root. The linter's
 * `LintResourceProvider` takes no fallback, so it reports the files the CLI reports.
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

/**
 * The nearest directory, from the document's own up to the workspace root, that
 * holds `project.godot`, or null when none does.
 */
export function findEnclosingGodotProject(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri
): Promise<vscode.Uri | null> {
  const documentDir = vscode.Uri.joinPath(documentUri, '..');
  return findProjectRoot(documentDir, parentUri, stopsAt(workspaceRoot), hasProjectFile);
}

/** `findEnclosingGodotProject`, or the workspace root when no directory holds `project.godot`. */
export async function findGodotProjectRoot(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri
): Promise<vscode.Uri> {
  return (await findEnclosingGodotProject(workspaceRoot, documentUri)) ?? workspaceRoot;
}
