/**
 * Lists a Godot project's files as `res://` paths, the seam the engine's path
 * completion reads. The listing runs once per project root and is cached. A completion
 * must not walk the workspace on every keystroke.
 */

import * as vscode from 'vscode';
import { isScannedDirectoryName } from '@textscene/core/godot';
import { findGodotProjectRoot } from './findGodotProjectRoot';

/** A cap on the listing, so a huge project does not stall a completion. */
const MAX_LISTED_FILES = 5000;

export class TscnResPathListing {
  private readonly _cache = new Map<string, Promise<readonly string[]>>();

  async pathsFor(document: vscode.TextDocument): Promise<readonly string[]> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return [];

    const root = await findGodotProjectRoot(folder.uri, document.uri);
    const key = root.toString();
    // The promise is cached, not its value: two completions before the walk ends share it.
    const cached = this._cache.get(key);
    if (cached) return cached;

    const listing = this._collect(root);
    this._cache.set(key, listing);
    return listing;
  }

  private async _collect(root: vscode.Uri): Promise<readonly string[]> {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(root, '**/*'),
      '**/{node_modules,.git}/**',
      MAX_LISTED_FILES
    );
    const rootPath = root.path.endsWith('/') ? root.path : `${root.path}/`;
    const paths: string[] = [];
    for (const file of files) {
      if (!file.path.startsWith(rootPath)) continue;
      const relative = file.path.slice(rootPath.length);
      // The editor's scan rules: a dot-named directory, such as `.godot`, is not entered.
      if (!relative.split('/').slice(0, -1).every(isScannedDirectoryName)) continue;
      paths.push(`res://${relative}`);
    }
    return paths.sort((a, b) => a.localeCompare(b));
  }

  /** Drops every listing, so a created or deleted file is offered on the next completion. */
  clear(): void {
    this._cache.clear();
  }
}
