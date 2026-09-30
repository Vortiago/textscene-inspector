/**
 * The linter's view of one Godot project: a `res://` path under its root, read from the workspace. Strict like the
 * CLI's provider, so both report the same files: null for a miss or a path that escapes the root. It logs nothing
 * for a miss, since a lint runs on each keystroke.
 */

import * as vscode from 'vscode';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import { resRelativePath } from '@textscene/core/resources/resPath';
import { isBinaryResourceType } from '@textscene/core/resources/resourceProviderUtils';

export class LintResourceProvider implements ResourceProvider {
  /** @param projectRoot - The directory that holds the project's `project.godot`. */
  constructor(private readonly projectRoot: vscode.Uri) {}

  async loadResource(resPath: string, type = ''): Promise<string | ArrayBuffer | null> {
    const file = this.fileOf(resPath);
    if (file === null) return null;
    let bytes: Uint8Array;
    try {
      bytes = await vscode.workspace.fs.readFile(file);
    } catch {
      // A missing dependency is the missing-resource path, which the provider contract spells as null.
      return null;
    }
    if (!isBinaryResourceType(type, resPath)) return new TextDecoder('utf-8').decode(bytes);
    // A copy, not `bytes.buffer`: a view may sit inside a larger buffer.
    return new Uint8Array(bytes).buffer;
  }

  /** The file's modification time and size, one `stat`, so the linter reads an unchanged file once. */
  async stamp(resPath: string): Promise<string | null> {
    const file = this.fileOf(resPath);
    if (file === null) return null;
    try {
      const { mtime, size } = await vscode.workspace.fs.stat(file);
      return `${mtime}:${size}`;
    } catch {
      // A file with no stamp is read, and the read answers a missing one with null.
      return null;
    }
  }

  /** The workspace file `resPath` names, or null for a path that is not `res://` or escapes the project. */
  fileOf(resPath: string): vscode.Uri | null {
    const relative = resRelativePath(resPath);
    return relative === null ? null : vscode.Uri.joinPath(this.projectRoot, relative);
  }
}
