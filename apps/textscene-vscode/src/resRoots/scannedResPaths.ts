import type * as vscode from 'vscode';
import { isScannedPath } from '@textscene/core/godot';
import { forwardSlashes, RES_SCHEME } from '@textscene/core/resources/resPath';

/** `root`'s path with one trailing slash, which each file under it starts with. */
function rootPrefixOf(root: vscode.Uri): string {
  const rootPath = forwardSlashes(root.path);
  return rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
}

/** The `res://` path of `file`, a file under the root whose path is `rootPrefix`. */
function resPathUnder(rootPrefix: string, file: vscode.Uri): string {
  return `${RES_SCHEME}${file.path.slice(rootPrefix.length)}`;
}

/** The `res://` path of the directory holding the file at `path`. */
function parentResPath(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < RES_SCHEME.length ? RES_SCHEME : path.slice(0, slash);
}

// A nested project.godot or .gdignore stops the scan below the root.
export function scannedResPaths(
  root: vscode.Uri,
  files: readonly vscode.Uri[],
  stopFiles: readonly vscode.Uri[]
): string[] {
  const rootPrefix = rootPrefixOf(root);
  const skipped = new Set(
    stopFiles.map((file) => parentResPath(resPathUnder(rootPrefix, file))).filter((dir) => dir !== RES_SCHEME)
  );
  return files.map((file) => resPathUnder(rootPrefix, file)).filter((path) => isScannedPath(path, skipped));
}
