/**
 * The webview's "jump to this node" request, resolved against the scene text
 * and carried out in the editor.
 */

import * as vscode from 'vscode';
import { findNodeHeadingLine } from './nodeHeadingResolver';

/**
 * The column of an editor tab that already holds `resource`, so the jump focuses that editor
 * instead of opening a duplicate. A tab on screen wins over one behind another tab. A tab in
 * the preview's own column is skipped: bringing it forward would cover the preview the user
 * just clicked in. Undefined when no other column holds it.
 */
function columnHolding(
  resource: vscode.Uri,
  previewColumn: vscode.ViewColumn | undefined
): vscode.ViewColumn | undefined {
  const key = resource.toString();
  const holding = vscode.window.tabGroups.all
    .filter((group) => group.viewColumn !== previewColumn)
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === key);
  return (holding.find((tab) => tab.isActive) ?? holding[0])?.group.viewColumn;
}

/** Column one, or the column beside the preview when the preview itself is in column one. */
function freshColumn(previewColumn: vscode.ViewColumn | undefined): vscode.ViewColumn {
  return previewColumn === vscode.ViewColumn.One ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;
}

/**
 * Open `resource` and put the cursor on `nodeName`'s heading, in the column of a tab that
 * already holds the scene, or else a fresh column, never over the preview in `previewColumn`.
 * A name the file does not carry is a warning, not an error: the webview's tree can outlive
 * an edit that removed the node.
 */
export async function jumpToNodeDefinition(
  resource: vscode.Uri,
  nodeName: string,
  expectedParent: string | undefined,
  previewColumn: vscode.ViewColumn | undefined
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
      viewColumn: columnHolding(resource, previewColumn) ?? freshColumn(previewColumn),
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
