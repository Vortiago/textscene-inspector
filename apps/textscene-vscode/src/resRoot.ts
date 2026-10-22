/**
 * Finds a document's `res://` root by core's `findResRoot`, for the preview, the language features and the agent
 * tools. The walk goes on above the workspace folder, as the Node hosts' walk does (ADR-0049).
 */

import * as vscode from 'vscode';
import { PROJECT_FILE_NAME } from '@textscene/core/godot';
import { findResRoot, isWithinRoot } from '@textscene/core/resources/resPath';
import { HOST_PATH_CASE } from './hostPathCase';

/**
 * The directory above `dir`, or null at the top. Through `joinPath`, never
 * `Uri.file`, so a virtual workspace keeps its scheme.
 */
function parentUri(dir: vscode.Uri): vscode.Uri | null {
  const parent = vscode.Uri.joinPath(dir, '..');
  return parent.path === dir.path ? null : parent;
}

/** The directory that holds the document. */
export function directoryOf(documentUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(documentUri, '..');
}

/** Whether `dir` holds `project.godot`, one `stat`. */
export async function hasProjectFile(dir: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.joinPath(dir, PROJECT_FILE_NAME));
    return true;
  } catch {
    // `stat` rejects for a missing file, which is the answer.
    return false;
  }
}

/**
 * The document's `res://` root: the nearest `project.godot` directory, at or above `workspaceRoot` too, else the
 * document's own directory when it lies in `workspaceRoot`, else null. `holdsProjectFile` answers for one directory,
 * so a caller can share its answers across documents.
 */
export function findResRootIn(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri,
  holdsProjectFile: (dir: vscode.Uri) => Promise<boolean> = hasProjectFile
): Promise<vscode.Uri | null> {
  const isInWorkspace = (dir: vscode.Uri) => isWithinRoot(workspaceRoot.fsPath, dir.fsPath, HOST_PATH_CASE);
  return findResRoot(directoryOf(documentUri), parentUri, holdsProjectFile, isInWorkspace);
}

/** The `res://` root of a document. Null outside every workspace folder, where no watcher keeps an answer current. */
export function resRootOf(
  documentUri: vscode.Uri,
  holdsProjectFile: (dir: vscode.Uri) => Promise<boolean> = hasProjectFile
): Promise<vscode.Uri | null> {
  const folder = vscode.workspace.getWorkspaceFolder(documentUri);
  return folder ? findResRootIn(folder.uri, documentUri, holdsProjectFile) : Promise.resolve(null);
}
