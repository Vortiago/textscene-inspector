/**
 * Turns `res://` references in a `.tscn` document into links, resolved against the
 * project root as Godot does, never against the current file.
 */

import * as vscode from 'vscode';
import { stripResPrefix } from '@textscene/core/resources/resourceProviderUtils';
import { findGodotProjectRoot } from './findGodotProjectRoot';

/** Matches a `res://` reference up to the next quote, whitespace, or closing paren. */
const RES_PATH_PATTERN = /res:\/\/[^"'\s)]+/g;

export class TscnResourceDocumentLink extends vscode.DocumentLink {
  constructor(
    range: vscode.Range,
    public readonly resourcePath: string,
    public readonly documentUri: vscode.Uri
  ) {
    super(range);
  }
}

export class TscnDocumentLinkProvider
  implements vscode.DocumentLinkProvider<TscnResourceDocumentLink>
{
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

  /** Computes ranges only: a synchronous regex scan with no IO. */
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<TscnResourceDocumentLink[]> {
    const links: TscnResourceDocumentLink[] = [];
    const pattern = new RegExp(RES_PATH_PATTERN);

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
      const lineText = document.lineAt(lineIndex).text;
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(lineText)) !== null) {
        const resourcePath = match[0];
        const range = new vscode.Range(
          new vscode.Position(lineIndex, match.index),
          new vscode.Position(lineIndex, match.index + resourcePath.length)
        );
        links.push(new TscnResourceDocumentLink(range, resourcePath, document.uri));
      }
    }

    return links;
  }

  /**
   * Resolves the link the user hovers or clicks through the `findGodotProjectRoot`
   * walk the preview panel shares. A document outside every workspace folder has no
   * project root, so its link stays unresolved rather than guessed.
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
    const relativePath = stripResPrefix(link.resourcePath);
    link.target = vscode.Uri.joinPath(projectRoot, relativePath);
    return link;
  }
}
