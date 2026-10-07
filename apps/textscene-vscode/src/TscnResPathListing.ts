/**
 * Lists the files under a document's `res://` root as `res://` paths, the seam the engine's
 * path completion reads. It caches one listing per root, so a completion does not walk the
 * workspace on every keystroke.
 */

import * as vscode from 'vscode';
import { resRootOf } from './resRoot';
import { scannedResPaths } from './scannedResPaths';
import { SCAN_STOP_FILES_PATTERN } from './watchPatterns';

/**
 * Godot's scan skips a dot-named directory, so the search skips it too, and never walks the
 * large `.godot` import cache. It skips nothing else: Godot enters `node_modules` as well.
 */
const DOT_DIRECTORIES = '**/.*/**';

export class TscnResPathListing {
  /** Each `res://` root's listing, written by `pathsFor` and dropped by `clear`. */
  private readonly _listingByRoot = new Map<string, Promise<readonly string[]>>();
  /**
   * Each document's `res://` root, null outside every workspace folder, written by `pathsFor` and dropped by `clear`.
   */
  private readonly _rootByDocument = new Map<string, Promise<vscode.Uri | null>>();

  /** The files under the document's `res://` root as `res://` paths, or none outside every workspace folder. */
  async pathsFor(document: vscode.TextDocument): Promise<readonly string[]> {
    const root = await this._rootOf(document.uri);
    if (!root) return [];
    const key = root.toString();
    // The promise is cached, not its value: two completions before the walk ends share it.
    const cached = this._listingByRoot.get(key);
    if (cached) return cached;

    const listing = this._list(root);
    this._listingByRoot.set(key, listing);
    return listing;
  }

  private _rootOf(documentUri: vscode.Uri): Promise<vscode.Uri | null> {
    const key = documentUri.toString();
    let root = this._rootByDocument.get(key);
    if (!root) {
      root = resRootOf(documentUri);
      this._rootByDocument.set(key, root);
    }
    return root;
  }

  /**
   * Every file Godot's editor scan reaches, as the `tscn-lsp` server lists them: no dot-named
   * directory, no nested project and no `.gdignore` directory.
   */
  private async _list(root: vscode.Uri): Promise<readonly string[]> {
    const [files, stopFiles] = await Promise.all([
      vscode.workspace.findFiles(new vscode.RelativePattern(root, '**/*'), DOT_DIRECTORIES),
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
