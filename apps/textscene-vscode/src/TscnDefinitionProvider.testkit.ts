/**
 * A `vscode.TextDocument` over a string of TSCN, for the
 * `TscnDefinitionProvider.*.test.ts` suites. Not a `.test.ts`, so vitest does not
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
