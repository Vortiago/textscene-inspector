/**
 * Walks up from a document's directory for `project.godot`, and falls back to the
 * workspace root, since Godot's `res://` is always project-root-relative. The
 * preview's `VSCodeResourceProvider` and `TscnDocumentLinkProvider` share it, so
 * both agree on where a `res://` path points. The walk itself is core's
 * `findProjectRoot`, which the CLI shares.
 */

import * as vscode from 'vscode';
import { comparablePath, findProjectRoot } from '@textscene/core/resources/resPath';

/** How many directories `dir` lies above `from`, an ancestor of it. */
function levelsAbove(from: string, dir: string): number {
  const depth = (path: string) => comparablePath(path).split('/').filter(Boolean).length;
  return depth(from) - depth(dir);
}

/**
 * The Uri of `dir`, an ancestor of `start` named by its path. Reached through
 * `joinPath`, never `Uri.file`, so a virtual workspace keeps its scheme.
 */
function ancestorUri(start: vscode.Uri, dir: string): vscode.Uri {
  const levels = levelsAbove(start.fsPath, dir);
  return levels === 0 ? start : vscode.Uri.joinPath(start, ...Array<string>(levels).fill('..'));
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
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
  const root = await findProjectRoot(documentDir.fsPath, workspaceRoot.fsPath, (dir) =>
    exists(vscode.Uri.joinPath(ancestorUri(documentDir, dir), 'project.godot'))
  );
  return root === null ? workspaceRoot : ancestorUri(documentDir, root);
}
