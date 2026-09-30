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
  /** Written by the first `loadResource`, so the walk runs once for the provider's lifetime. */
  private projectRoot: Promise<vscode.Uri | null> | null = null;

  constructor(
    private readonly workspaceRoot: vscode.Uri,
    private readonly documentUri: vscode.Uri
  ) {}

  async loadResource(resPath: string, type = ''): Promise<string | ArrayBuffer | null> {
    const relative = resRelativePath(resPath);
    if (relative === null) return null;
    this.projectRoot ??= findEnclosingGodotProject(this.workspaceRoot, this.documentUri);
    const root = await this.projectRoot;
    if (root === null) return null;
    const file = vscode.Uri.joinPath(root, relative);
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
}
