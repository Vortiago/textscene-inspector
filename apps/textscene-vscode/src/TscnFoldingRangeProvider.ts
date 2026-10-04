/**
 * Folding ranges for `.tscn` files: one fold per node and resource body, nested by
 * the sections' own line spans.
 */

import * as vscode from 'vscode';
import { createLanguageDocument, foldingRanges } from '@textscene/core/languageFeatures';

export class TscnFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): vscode.FoldingRange[] {
    const engine = createLanguageDocument(document.getText());
    return foldingRanges(engine).map(
      (range) => new vscode.FoldingRange(range.startLine, range.endLine, vscode.FoldingRangeKind.Region)
    );
  }
}
