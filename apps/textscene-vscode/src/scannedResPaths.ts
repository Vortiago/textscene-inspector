/**
 * The files a workspace search found under a `res://` root, as the `res://` paths the editor's
 * scan reaches. The linter's listing and `res://` completion both filter through it, so both
 * offer the files Godot's scan finds.
 */

import type * as vscode from 'vscode';
import { isScannedPath } from '@textscene/core/godot';
import { forwardSlashes, RES_SCHEME } from '@textscene/core/resources/resPath';

/** The `res://` path of `file`, a file under `root`. */
function resPathUnder(root: vscode.Uri, file: vscode.Uri): string {
  const rootPath = forwardSlashes(root.path);
  const rootPrefix = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
  return `${RES_SCHEME}${file.path.slice(rootPrefix.length)}`;
}

/** The `res://` path of the directory holding the file at `path`. */
function parentResPath(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < RES_SCHEME.length ? RES_SCHEME : path.slice(0, slash);
}

/**
 * The `res://` paths of `files` the scan reaches. The scan skips the whole of a directory
 * below the root that holds one of `stopFiles`: a nested `project.godot` or a `.gdignore`.
 */
export function scannedResPaths(
  root: vscode.Uri,
  files: readonly vscode.Uri[],
  stopFiles: readonly vscode.Uri[]
): string[] {
  const skipped = new Set(
    stopFiles.map((file) => parentResPath(resPathUnder(root, file))).filter((dir) => dir !== RES_SCHEME)
  );
  return files.map((file) => resPathUnder(root, file)).filter((path) => isScannedPath(path, skipped));
}
