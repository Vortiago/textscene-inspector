/**
 * Turns `res://` references in a `.tscn` document into links, resolved against the
 * project root as Godot does, or against the document's directory outside every project.
 */

import * as vscode from 'vscode';
import { resPathOccurrences } from '@textscene/core/languageFeatures';
import { languageDocumentOf } from './languageDocumentOf';
import { toVscodeRange } from './languageFeatureRanges';
import type { WorkspaceResRoots } from './resRoots/workspaceResRoots';

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
  constructor(private readonly roots: WorkspaceResRoots) {}

  /** Computes ranges only, from the engine's scan, with no IO. */
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): TscnResourceDocumentLink[] {
    return resPathOccurrences(languageDocumentOf(document)).map(
      ({ path, range }) => new TscnResourceDocumentLink(toVscodeRange(range), path, document.uri)
    );
  }

  /** Resolves the link against the document's current `res://` root. */
  async resolveDocumentLink(
    link: TscnResourceDocumentLink,
    _token: vscode.CancellationToken
  ): Promise<TscnResourceDocumentLink | undefined> {
    const root = await this.roots.rootOf(link.documentUri);
    const target = await root?.existingFile(link.resourcePath);
    if (!target) return undefined;
    link.target = target;
    return link;
  }
}
