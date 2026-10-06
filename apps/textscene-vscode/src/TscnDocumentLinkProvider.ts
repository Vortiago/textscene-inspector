/**
 * Turns `res://` references in a `.tscn` document into links, resolved against the
 * project root as Godot does, or against the document's directory outside every project.
 */

import * as vscode from 'vscode';
import { resPathOccurrences } from '@textscene/core/languageFeatures';
import { existingResFile } from './existingResFile';
import { resRootOf } from './resRoot';
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
   * Resolves the link the user hovers or clicks against the document's `res://` root. A document outside every
   * workspace folder gets no target. Nor does a path that climbs out of the root, a missing file or a directory, since
   * none names a file to open. The `tscn-lsp` server answers the same. The walk runs on each resolve, a few `stat`s,
   * so a `project.godot` created later counts at once.
   */
  async resolveDocumentLink(
    link: TscnResourceDocumentLink,
    _token: vscode.CancellationToken
  ): Promise<TscnResourceDocumentLink | undefined> {
    const resRoot = await resRootOf(link.documentUri);
    if (!resRoot) return undefined;
    const target = await existingResFile(resRoot, link.resourcePath);
    if (!target) return undefined;
    link.target = target;
    return link;
  }
}
