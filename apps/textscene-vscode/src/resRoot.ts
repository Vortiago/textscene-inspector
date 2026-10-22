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

/**
 * Whether each directory holds `project.godot`, so every walk shares one `stat` per directory. The walk goes above the
 * workspace folder, where no watcher reports a change. Written only by `holdsProjectFile`. Cleared by
 * `forgetProjectFiles`.
 */
const projectFileByDir = new Map<string, Promise<boolean>>();

/** Whether `dir` holds `project.godot`, from one `stat` until `forgetProjectFiles` runs. */
function holdsProjectFile(dir: vscode.Uri): Promise<boolean> {
  const key = dir.toString();
  let answer = projectFileByDir.get(key);
  if (!answer) {
    answer = hasProjectFile(dir);
    projectFileByDir.set(key, answer);
  }
  return answer;
}

/**
 * Forgets every directory's answer, so the next walk asks `stat` again. The extension calls it on each `project.godot`
 * event and when the window gains focus, since a directory above the workspace has no watcher. `TscnDiagnostics` calls
 * it before the walks it starts on a `project.godot` event, and when it drops a project root.
 */
export function forgetProjectFiles(): void {
  projectFileByDir.clear();
}

async function hasProjectFile(dir: vscode.Uri): Promise<boolean> {
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
 * document's own directory when it lies in `workspaceRoot`, else null. `holds` answers for one directory, the shared
 * answers unless a test gives its own.
 */
export function findResRootIn(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri,
  holds: (dir: vscode.Uri) => Promise<boolean> = holdsProjectFile
): Promise<vscode.Uri | null> {
  const isInWorkspace = (dir: vscode.Uri) => isWithinRoot(workspaceRoot.fsPath, dir.fsPath, HOST_PATH_CASE);
  return findResRoot(directoryOf(documentUri), parentUri, holds, isInWorkspace);
}

/** The `res://` root of a document. Null outside every workspace folder. */
export function resRootOf(documentUri: vscode.Uri): Promise<vscode.Uri | null> {
  const folder = vscode.workspace.getWorkspaceFolder(documentUri);
  return folder ? findResRootIn(folder.uri, documentUri) : Promise.resolve(null);
}
