/**
 * The project file a `res://` path names, for a definition or a link to open. Both hosts
 * answer only a file that exists: a missing one would open an empty editor, and a directory
 * cannot open as a document.
 */

import * as vscode from 'vscode';
import { resRelativePath } from '@textscene/core/resources/resPath';

/** The file `resPath` names under `projectRoot`, or null for a path that is not `res://`, a missing file or a directory. */
export async function existingResFile(projectRoot: vscode.Uri, resPath: string): Promise<vscode.Uri | null> {
  const relativePath = resRelativePath(resPath);
  if (relativePath === null) return null;
  const file = vscode.Uri.joinPath(projectRoot, relativePath);
  try {
    const { type } = await vscode.workspace.fs.stat(file);
    return type & vscode.FileType.File ? file : null;
  } catch {
    // Absent or unreadable: either way there is no file to open.
    return null;
  }
}
