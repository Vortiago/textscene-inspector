/**
 * The linter's view of one Godot project: a `res://` path under its root, read from the workspace, and its files by
 * extension. Strict like the CLI's provider, so both report the same files: null for a miss or a path that escapes the
 * root. It logs nothing for a miss, since a lint runs on each keystroke.
 */

import * as vscode from 'vscode';
import type { ResourceProvider } from '@textscene/core/resources/ResourceProvider';
import { isWithinRoot, resRelativePath } from '@textscene/core/resources/resPath';
import { resourceContent } from '@textscene/core/resources/resourceProviderUtils';
import { isScannedPath } from '@textscene/core/godot';
import { anyCase } from './anyCaseGlob';
import { SCAN_STOP_FILES_PATTERN } from './watchPatterns';

const ROOT = 'res://';

/** The `res://` path of the directory holding the file at `path`. */
function parentResPath(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < ROOT.length ? ROOT : path.slice(0, slash);
}

export class LintResourceProvider implements ResourceProvider {
  /** The `res://` paths the last listing that answered found. Written only by `listFiles`. */
  private _listed: readonly string[] = [];

  /** @param projectRoot - The directory that holds the project's `project.godot`. */
  constructor(private readonly projectRoot: vscode.Uri) {}

  /** The `res://` paths the last listing that answered found, so a host can tell when one of them goes. */
  get listed(): readonly string[] {
    return this._listed;
  }

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
    return resourceContent(bytes, type, resPath);
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

  /**
   * Every file with `extension` the editor's scan reaches, found with `findFiles`. A null exclude turns off
   * `files.exclude` and `.gitignore` (`extHostWorkspace.ts:503-518` in VS Code), which Godot's scan does not read. Null
   * when the search fails.
   */
  async listFiles(extension: string): Promise<string[] | null> {
    const search = (glob: string) =>
      vscode.workspace.findFiles(new vscode.RelativePattern(this.projectRoot, glob), null);
    try {
      const candidates = await search(`**/*.${anyCase(extension)}`);
      // A stop file only removes a candidate, so the second whole-project search runs only when there is one.
      const stopFiles = candidates.length === 0 ? [] : await search(SCAN_STOP_FILES_PATTERN);
      const skipped = new Set(
        stopFiles.map((file) => parentResPath(this.resPathOf(file))).filter((dir) => dir !== ROOT)
      );
      this._listed = candidates
        .map((file) => this.resPathOf(file))
        .filter((path) => isScannedPath(path, skipped));
      return [...this._listed];
    } catch {
      // A search that fails proves nothing, which the linter reads as "may hold one".
      return null;
    }
  }

  /** The `res://` path of `file`, a file the search found under the project root. */
  private resPathOf(file: vscode.Uri): string {
    const rootPath = this.projectRoot.path.replace(/\/+$/, '');
    return `${ROOT}${file.path.slice(rootPath.length + 1)}`;
  }

  /** Whether `file` lies under the project root. */
  holds(file: vscode.Uri): boolean {
    return isWithinRoot(this.projectRoot.fsPath, file.fsPath);
  }

  /** Whether the project root is `dir` or lies under it. */
  isRootedWithin(dir: vscode.Uri): boolean {
    return isWithinRoot(dir.fsPath, this.projectRoot.fsPath);
  }

  /** The workspace file `resPath` names, or null for a path that is not `res://` or escapes the project. */
  fileOf(resPath: string): vscode.Uri | null {
    const relative = resRelativePath(resPath);
    return relative === null ? null : vscode.Uri.joinPath(this.projectRoot, relative);
  }
}
