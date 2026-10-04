/**
 * Highlights every use of the resource id under the cursor, its declaration heading
 * included, so a reader sees where one `ExtResource` or `SubResource` id is spent.
 */

import * as vscode from 'vscode';
import { createLanguageDocument, documentHighlights } from '@textscene/core/languageFeatures';
import { toEnginePosition, toVscodeRange } from './languageFeatureRanges';

export class TscnDocumentHighlightProvider implements vscode.DocumentHighlightProvider {
  provideDocumentHighlights(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.DocumentHighlight[] {
    const engine = createLanguageDocument(document.getText());
    return documentHighlights(engine, toEnginePosition(position)).map(
      (highlight) =>
        new vscode.DocumentHighlight(toVscodeRange(highlight.range), vscode.DocumentHighlightKind.Text)
    );
  }
}
