/**
 * Folding ranges for `.tscn` files: one fold per node and resource body, from the
 * heading to the last content line.
 */

import * as vscode from 'vscode';
import { foldingRanges } from '@textscene/core/languageFeatures';
import { languageDocumentOf } from './languageDocumentOf';

export class TscnFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(
    document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): vscode.FoldingRange[] {
    return foldingRanges(languageDocumentOf(document)).map(
      (range) => new vscode.FoldingRange(range.startLine, range.endLine, vscode.FoldingRangeKind.Region)
    );
  }
}
