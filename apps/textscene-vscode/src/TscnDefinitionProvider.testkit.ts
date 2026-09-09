/**
 * A `vscode.TextDocument` over a string of TSCN, for the provider suites.
 *
 * Shared by the `TscnDefinitionProvider.*.test.ts` files, which split the
 * provider's cases by topic; a non-`.test.ts` module so vitest does not try to
 * collect it.
 */

import * as vscode from 'vscode';

export function createMockDocument(content: string): vscode.TextDocument {
  const lines = content.split('\n');
  return {
    getText: () => content,
    lineAt: (lineOrPosition: number | vscode.Position) => {
      const lineNumber =
        typeof lineOrPosition === 'number'
          ? lineOrPosition
          : lineOrPosition.line;
      return {
        text: lines[lineNumber] || '',
        lineNumber: lineNumber,
        range: new vscode.Range(
          new vscode.Position(lineNumber, 0),
          new vscode.Position(lineNumber, (lines[lineNumber] || '').length)
        ),
        rangeIncludingLineBreak: new vscode.Range(
          new vscode.Position(lineNumber, 0),
          new vscode.Position(lineNumber + 1, 0)
        ),
        firstNonWhitespaceCharacterIndex: 0,
        isEmptyOrWhitespace: (lines[lineNumber] || '').trim().length === 0,
      };
    },
    lineCount: lines.length,
    uri: vscode.Uri.file('/test.tscn'),
  } as vscode.TextDocument;
}
