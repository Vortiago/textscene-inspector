/**
 * The files a workspace search found under a project root, as the `res://` paths the editor's
 * scan reaches. The linter's listing and `res://` completion both filter through it, so both
 * offer the files Godot's scan finds.
 */

import type * as vscode from 'vscode';
import { isScannedPath } from '@textscene/core/godot';

const ROOT = 'res://';

/** The `res://` path of `file`, a file under `root`. */
function resPathUnder(root: vscode.Uri, file: vscode.Uri): string {
  const rootPath = root.path.replace(/\/+$/, '');
  return `${ROOT}${file.path.slice(rootPath.length + 1)}`;
}

/** The `res://` path of the directory holding the file at `path`. */
function parentResPath(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < ROOT.length ? ROOT : path.slice(0, slash);
}

/**
 * The `res://` paths of `files` the scan reaches. A directory below the root that holds one of
 * `stopFiles`, a nested `project.godot` or a `.gdignore`, is skipped whole.
 */
export function scannedResPaths(
  root: vscode.Uri,
  files: readonly vscode.Uri[],
  stopFiles: readonly vscode.Uri[]
): string[] {
  const skipped = new Set(
    stopFiles.map((file) => parentResPath(resPathUnder(root, file))).filter((dir) => dir !== ROOT)
  );
  return files.map((file) => resPathUnder(root, file)).filter((path) => isScannedPath(path, skipped));
}
