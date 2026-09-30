/**
 * The linter's view of a document's Godot project: a `res://` path under the root
 * `findGodotProjectRoot` finds, read from the workspace. Strict like the CLI's
 * provider, so both report the same files: null for a miss or a path that escapes
 * the root, with no fallback to the document's directory, which Godot never reads.
 * It logs nothing for a miss, since a lint runs on each keystroke.
 */

import * as vscode from 'vscode';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import { resRelativePath } from '@textscene/core/resources/resPath';
import { isBinaryResourceType } from '@textscene/core/resources/resourceProviderUtils';
import { findGodotProjectRoot } from './findGodotProjectRoot';

export class LintResourceProvider implements ResourceProvider {
  /** Written by the first `loadResource`, so the walk runs once for the provider's lifetime. */
  private projectRoot: Promise<vscode.Uri> | null = null;

  constructor(
    private readonly workspaceRoot: vscode.Uri,
    private readonly documentUri: vscode.Uri
  ) {}

  async loadResource(resPath: string, type = ''): Promise<string | ArrayBuffer | null> {
    const relative = resRelativePath(resPath);
    if (relative === null) return null;
    this.projectRoot ??= findGodotProjectRoot(this.workspaceRoot, this.documentUri);
    const file = vscode.Uri.joinPath(await this.projectRoot, relative);
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
