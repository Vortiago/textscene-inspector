/**
 * Finds a document's `res://` root: the nearest directory with `project.godot`, from the document's own up to the
 * workspace folder, the furthest the watchers see. Outside every project, the editor features root `res://` at the
 * document's directory (core's `findResRoot`). The preview tries the workspace root, then the document's directory.
 */

import * as vscode from 'vscode';
import { PROJECT_FILE_NAME } from '@textscene/core/godot';
import {
  comparablePath,
  findProjectRoot,
  findResRoot,
  isWithinRoot,
} from '@textscene/core/resources/resPath';
import { HOST_PATH_CASE } from './hostPathCase';

/**
 * The directory above `dir`, or null at the top. Through `joinPath`, never
 * `Uri.file`, so a virtual workspace keeps its scheme.
 */
function parentUri(dir: vscode.Uri): vscode.Uri | null {
  const parent = vscode.Uri.joinPath(dir, '..');
  return parent.path === dir.path ? null : parent;
}

function directoryOf(documentUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(documentUri, '..');
}

/** Whether the walk ends at a directory: the workspace root itself, or one outside it. */
function stopsAt(workspaceRoot: vscode.Uri): (dir: vscode.Uri) => boolean {
  const rootKey = comparablePath(workspaceRoot.fsPath);
  return (dir) =>
    comparablePath(dir.fsPath) === rootKey || !isWithinRoot(workspaceRoot.fsPath, dir.fsPath, HOST_PATH_CASE);
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
 * The nearest directory, from the document's own up to the workspace root, that
 * holds `project.godot`, or null when none does. `holdsProjectFile` answers for one
 * directory, so a caller can share its answers across documents.
 */
export function findEnclosingGodotProject(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri,
  holdsProjectFile: (dir: vscode.Uri) => Promise<boolean> = hasProjectFile
): Promise<vscode.Uri | null> {
  return findProjectRoot(directoryOf(documentUri), parentUri, stopsAt(workspaceRoot), holdsProjectFile);
}

/** `findEnclosingGodotProject`, or the workspace root when no directory holds `project.godot`. For the preview. */
export async function findGodotProjectRoot(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri
): Promise<vscode.Uri> {
  return (await findEnclosingGodotProject(workspaceRoot, documentUri)) ?? workspaceRoot;
}

/**
 * The directory the document's `res://` paths resolve under: `findEnclosingGodotProject`, or the
 * document's own directory when no directory up to the workspace root holds `project.godot`.
 */
export function findResRootIn(
  workspaceRoot: vscode.Uri,
  documentUri: vscode.Uri,
  holdsProjectFile: (dir: vscode.Uri) => Promise<boolean> = hasProjectFile
): Promise<vscode.Uri> {
  return findResRoot(directoryOf(documentUri), parentUri, stopsAt(workspaceRoot), holdsProjectFile);
}

/**
 * The `res://` root of a document, for the language features and the agent tools: its Godot project, or its own
 * directory outside every project. Null outside every workspace folder, where no watcher keeps an answer current.
 */
export function resRootOf(documentUri: vscode.Uri): Promise<vscode.Uri | null> {
  const folder = vscode.workspace.getWorkspaceFolder(documentUri);
  return folder ? findResRootIn(folder.uri, documentUri) : Promise.resolve(null);
}
