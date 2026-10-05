/**
 * Highlights every use of the resource id under the cursor, its declaration heading
 * included, so a reader sees where one `ExtResource` or `SubResource` id is spent.
 */

import * as vscode from 'vscode';
import { documentHighlights } from '@textscene/core/languageFeatures';
import { languageDocumentOf } from './languageDocumentOf';
import { toVscodeRange } from './languageFeatureRanges';

export class TscnDocumentHighlightProvider implements vscode.DocumentHighlightProvider {
  provideDocumentHighlights(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.DocumentHighlight[] {
    return documentHighlights(languageDocumentOf(document), position).map(
      (highlight) =>
        new vscode.DocumentHighlight(toVscodeRange(highlight.range), vscode.DocumentHighlightKind.Text)
    );
  }
}
