/**
 * Hover for `.tscn` files: the class a heading names, the engine facts behind a
 * property, and the declaration a resource reference points at. The answer comes from
 * `@textscene/core/languageFeatures`, so it matches the `tscn-lsp` server's.
 */

import * as vscode from 'vscode';
import { hoverAt } from '@textscene/core/languageFeatures';
import { languageDocumentOf } from './languageDocumentOf';
import { toVscodeRange } from './languageFeatureRanges';

export class TscnHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    const hover = hoverAt(languageDocumentOf(document), position);
    if (!hover) return undefined;
    const contents = new vscode.MarkdownString(hover.markdown);
    return new vscode.Hover(contents, hover.range ? toVscodeRange(hover.range) : undefined);
  }
}
