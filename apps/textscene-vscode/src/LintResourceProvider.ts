/**
 * The linter's view of a document's Godot project: a `res://` path under the root
 * `findEnclosingGodotProject` finds, read from the workspace. Strict like the CLI's
 * provider, so both report the same files: null for a miss, a path that escapes
 * the root, or a document in no Godot project. It falls back neither to the
 * workspace root nor to the document's directory, which Godot never reads.
 * It logs nothing for a miss, since a lint runs on each keystroke.
 */

import * as vscode from 'vscode';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import { resRelativePath } from '@textscene/core/resources/resPath';
import { isBinaryResourceType } from '@textscene/core/resources/resourceProviderUtils';
import { findEnclosingGodotProject } from './findGodotProjectRoot';

export class LintResourceProvider implements ResourceProvider {
  /** Written by the first `loadResource` or `stamp`, so the walk runs once for the provider's lifetime. */
  private projectRoot: Promise<vscode.Uri | null> | null = null;

  constructor(
    /** The workspace folder the document sits in, which bounds the walk. */
    readonly workspaceRoot: vscode.Uri,
    private readonly documentUri: vscode.Uri
  ) {}

  async loadResource(resPath: string, type = ''): Promise<string | ArrayBuffer | null> {
    const file = await this.fileOf(resPath);
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
    const file = await this.fileOf(resPath);
    if (file === null) return null;
    try {
      const { mtime, size } = await vscode.workspace.fs.stat(file);
      return `${mtime}:${size}`;
    } catch {
      // A file with no stamp is read, and the read answers a missing one with null.
      return null;
    }
  }

  /** The workspace file `resPath` names, or null for a path outside the project or a document in none. */
  private async fileOf(resPath: string): Promise<vscode.Uri | null> {
    const relative = resRelativePath(resPath);
    if (relative === null) return null;
    this.projectRoot ??= findEnclosingGodotProject(this.workspaceRoot, this.documentUri);
    const root = await this.projectRoot;
    return root === null ? null : vscode.Uri.joinPath(root, relative);
  }
}
