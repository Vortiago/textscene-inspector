/**
 * The `TextScene: Copy Node Path` command: it copies the path Godot's "Copy Node Path" writes for
 * the `[node]` section that holds the cursor.
 */

import * as vscode from 'vscode';
import { nodePathAt } from '@textscene/core/languageFeatures';
import { languageDocumentOf } from './languageDocumentOf';

export async function copyNodePathAtCursor(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const nodePath = editor && nodePathAt(languageDocumentOf(editor.document), editor.selection.active);
  if (nodePath === undefined) {
    void vscode.window.showInformationMessage('Put the cursor in a [node] section to copy its node path.');
    return;
  }
  await vscode.env.clipboard.writeText(nodePath);
}
