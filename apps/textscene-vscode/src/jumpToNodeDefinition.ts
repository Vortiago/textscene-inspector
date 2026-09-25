/**
 * The webview's "jump to this node" request, resolved against the scene text
 * and carried out in the editor.
 */

import * as vscode from 'vscode';
import { findNodeHeadingLine } from './nodeHeadingResolver';

/**
 * The column of an editor tab that already holds `resource`, so the jump focuses
 * that editor instead of opening a duplicate. A tab on screen wins over one behind
 * another tab. Undefined when no tab holds it.
 */
function columnHolding(resource: vscode.Uri): vscode.ViewColumn | undefined {
  const key = resource.toString();
  const holding = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === key);
  return (holding.find((tab) => tab.isActive) ?? holding[0])?.group.viewColumn;
}

/**
 * Open `resource` and put the cursor on `nodeName`'s heading, in the column of a tab
 * that already holds the scene, or else column one. A name the file does not carry is a
 * warning, not an error: the webview's tree can outlive an edit that removed the node.
 */
export async function jumpToNodeDefinition(
  resource: vscode.Uri,
  nodeName: string,
  expectedParent?: string
): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(resource);
    const text = document.getText();
    const lines = text.split('\n');

    const targetLine = findNodeHeadingLine(lines, nodeName, expectedParent);

    if (targetLine === -1) {
      vscode.window.showWarningMessage(`Could not find node "${nodeName}" in file`);
      return;
    }

    const editor = await vscode.window.showTextDocument(document, {
      viewColumn: columnHolding(resource) ?? vscode.ViewColumn.One,
      preserveFocus: false,
    });

    const position = new vscode.Position(targetLine, 0);
    const range = new vscode.Range(position, position);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to jump to node: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
