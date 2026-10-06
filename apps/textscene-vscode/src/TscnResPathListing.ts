/**
 * Lists a Godot project's files as `res://` paths, the seam the engine's path
 * completion reads. It caches one listing per project root, so a completion does not
 * walk the workspace on every keystroke.
 */

import * as vscode from 'vscode';
import { findGodotProjectRoot } from './findGodotProjectRoot';
import { scannedResPaths } from './scannedResPaths';
import { SCAN_STOP_FILES_PATTERN } from './watchPatterns';

/** A cap on the listing, so a huge project does not stall a completion. */
const MAX_LISTED_FILES = 5000;

/**
 * The search skips a dot-named directory itself, so a `.godot` import cache spends none of
 * the cap. `node_modules` holds no Godot resource worth offering.
 */
const EXCLUDED_DIRECTORIES = '**/{node_modules,.*}/**';

export class TscnResPathListing {
  /** Each project root's listing, written by `pathsFor` and dropped by `clear`. */
  private readonly _listingByRoot = new Map<string, Promise<readonly string[]>>();
  /** Each document's project root, written by `pathsFor` and dropped by `clear`. */
  private readonly _rootByDocument = new Map<string, Promise<vscode.Uri>>();

  async pathsFor(document: vscode.TextDocument): Promise<readonly string[]> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return [];

    const root = await this._rootOf(folder, document.uri);
    const key = root.toString();
    // The promise is cached, not its value: two completions before the walk ends share it.
    const cached = this._listingByRoot.get(key);
    if (cached) return cached;

    const listing = this._list(root);
    this._listingByRoot.set(key, listing);
    return listing;
  }

  private _rootOf(folder: vscode.WorkspaceFolder, documentUri: vscode.Uri): Promise<vscode.Uri> {
    const key = documentUri.toString();
    let root = this._rootByDocument.get(key);
    if (!root) {
      root = findGodotProjectRoot(folder.uri, documentUri);
      this._rootByDocument.set(key, root);
    }
    return root;
  }

  /**
   * The editor's scan rules, as the linter reads them: no dot-named directory, no nested
   * project and no `.gdignore` directory.
   */
  private async _list(root: vscode.Uri): Promise<readonly string[]> {
    const [files, stopFiles] = await Promise.all([
      vscode.workspace.findFiles(
        new vscode.RelativePattern(root, '**/*'),
        EXCLUDED_DIRECTORIES,
        MAX_LISTED_FILES
      ),
      // No exclude, as the linter's own search does: `.gdignore` is itself dot-named.
      vscode.workspace.findFiles(new vscode.RelativePattern(root, SCAN_STOP_FILES_PATTERN), null),
    ]);
    return scannedResPaths(root, files, stopFiles).sort((a, b) => a.localeCompare(b));
  }

  /** Drops every listing and root, so a created or deleted file is offered on the next completion. */
  clear(): void {
    this._listingByRoot.clear();
    this._rootByDocument.clear();
  }
}
