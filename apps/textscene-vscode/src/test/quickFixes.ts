/** The quick fixes VS Code answers for a range, as the extension host suites ask for them. */

import * as vscode from 'vscode';

export function quickFixesAt(uri: vscode.Uri, range: vscode.Range): Thenable<vscode.CodeAction[]> {
  return vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', uri, range);
}
