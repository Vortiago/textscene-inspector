/**
 * Turns `res://` references in a `.tscn` document into clickable links that
 * open the referenced file — resolved project-root-relative, matching
 * Godot's own `res://` convention (never relative to the current file).
 *
 * `provideDocumentLinks` only computes ranges: a synchronous regex scan, no
 * IO. `resolveDocumentLink` fills in the target `Uri` lazily, only for the
 * link the user actually hovers/clicks, via the shared
 * `findGodotProjectRoot` walk (also used by `VSCodeResourceProvider`) so
 * this agrees with how the preview panel resolves the same paths. A
 * document outside any workspace folder has no project root to resolve
 * against, so its links stay unresolved (VS Code just won't offer to open
 * them) rather than guessing.
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

  async resolveDocumentLink(
    link: TscnResourceDocumentLink,
    _token: vscode.CancellationToken
  ): Promise<TscnResourceDocumentLink | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(link.documentUri);
    if (!workspaceFolder) {
      return undefined;
    }

    const projectRoot = await findGodotProjectRoot(workspaceFolder.uri, link.documentUri);
    const relativePath = stripResPrefix(link.resourcePath);
    link.target = vscode.Uri.joinPath(projectRoot, relativePath);
    return link;
  }
}
