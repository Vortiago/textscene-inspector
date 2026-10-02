/**
 * Reads a workspace file a scene names, after one `stat` refuses a file the host must not read: a symbolic link, which
 * can point outside the workspace, or a file too large to hand to the webview.
 */

import * as vscode from 'vscode';

/**
 * The largest file the host reads, in bytes. The webview gets it base64-encoded, at 4/3 of its size, and 256 MiB keeps
 * that string well under V8's limit of 2^29 - 24 characters.
 */
export const MAX_READ_BYTES = 256 * 1024 * 1024;

/** Why the host refuses to read a file with this `stat`, or null for a file it reads. */
export function readRefusal(stat: Pick<vscode.FileStat, 'type' | 'size'>): string | null {
  // `type` is a bit field: a link to a file is `File | SymbolicLink`.
  if ((stat.type & vscode.FileType.SymbolicLink) !== 0) {
    return 'is a symbolic link, which can point outside the workspace';
  }
  if (stat.size > MAX_READ_BYTES) {
    return `is ${stat.size} bytes, over the limit of ${MAX_READ_BYTES} bytes`;
  }
  return null;
}

/** The bytes of `file`. It throws for a file `readRefusal` refuses, and for a failed `stat` or read. */
export async function readWorkspaceFile(file: vscode.Uri): Promise<Uint8Array> {
  const refusal = readRefusal(await vscode.workspace.fs.stat(file));
  if (refusal !== null) throw new Error(`${file.fsPath} ${refusal}`);
  return vscode.workspace.fs.readFile(file);
}
