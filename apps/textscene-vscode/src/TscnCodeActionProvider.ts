/**
 * Quick fixes for `.tscn` files: a deprecated property spelling renamed to the
 * engine's, an unknown property key or class repaired to its nearest catalogued
 * spelling. The engine computes the edits; this puts them in a `WorkspaceEdit`.
 */

import * as vscode from 'vscode';
import { codeActions, createLanguageDocument } from '@textscene/core/languageFeatures';
import { toEngineRange, toVscodeRange } from './languageFeatureRanges';

export class TscnCodeActionProvider implements vscode.CodeActionProvider {
  readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const engine = createLanguageDocument(document.getText());
    return codeActions(engine, toEngineRange(range)).map((action) => {
      const fix = new vscode.CodeAction(action.title, vscode.CodeActionKind.QuickFix);
      const edit = new vscode.WorkspaceEdit();
      for (const textEdit of action.edit) {
        edit.replace(document.uri, toVscodeRange(textEdit.range), textEdit.newText);
      }
      fix.edit = edit;
      return fix;
    });
  }
}
