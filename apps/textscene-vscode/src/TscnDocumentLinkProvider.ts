/**
 * Turns `res://` references in a `.tscn` document into links, resolved against the
 * project root as Godot does, never against the current file.
 */

import * as vscode from 'vscode';
import { resPathOccurrences } from '@textscene/core/languageFeatures';
import { existingResFile } from './existingResFile';
import { findGodotProjectRoot } from './findGodotProjectRoot';
import { languageDocumentOf } from './languageDocumentOf';
import { toVscodeRange } from './languageFeatureRanges';

export class TscnResourceDocumentLink extends vscode.DocumentLink {
  constructor(
    range: vscode.Range,
    public readonly resourcePath: string,
    public readonly documentUri: vscode.Uri
  ) {
    super(range);
  }
}

export class TscnDocumentLinkProvider implements vscode.DocumentLinkProvider<TscnResourceDocumentLink> {
  /**
   * `findGodotProjectRoot` result, keyed by the document's own directory, so one
   * walk serves every link and re-hover. Not keyed by workspace folder: one folder
   * can hold several Godot projects, and each must get its own root.
   * `VSCodeResourceProvider` caches per panel instead, one document each.
   */
  private readonly _projectRootCache = new Map<string, vscode.Uri>();

  private async _resolveProjectRoot(
    workspaceFolder: vscode.WorkspaceFolder,
    documentUri: vscode.Uri
  ): Promise<vscode.Uri> {
    const key = vscode.Uri.joinPath(documentUri, '..').toString();
    const cached = this._projectRootCache.get(key);
    if (cached) return cached;

    const root = await findGodotProjectRoot(workspaceFolder.uri, documentUri);
    this._projectRootCache.set(key, root);
    return root;
  }

  /** Computes ranges only, from the engine's scan, with no IO. */
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): TscnResourceDocumentLink[] {
    return resPathOccurrences(languageDocumentOf(document)).map(
      ({ path, range }) => new TscnResourceDocumentLink(toVscodeRange(range), path, document.uri)
    );
  }

  /**
   * Resolves the link the user hovers or clicks through the `findGodotProjectRoot`
   * walk the preview panel shares. A document outside every workspace folder has no
   * project root, and a path that climbs out of the root, a missing file or a directory
   * names no file to open, so none gets a target. The `tscn-lsp` server answers the same.
   */
  async resolveDocumentLink(
    link: TscnResourceDocumentLink,
    _token: vscode.CancellationToken
  ): Promise<TscnResourceDocumentLink | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(link.documentUri);
    if (!workspaceFolder) {
      return undefined;
    }
    const projectRoot = await this._resolveProjectRoot(workspaceFolder, link.documentUri);
    const target = await existingResFile(projectRoot, link.resourcePath);
    if (!target) return undefined;
    link.target = target;
    return link;
  }
}
