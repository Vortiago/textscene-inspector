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
    const targetLine = findNodeHeadingLine(document.getText().split('\n'), nodeName, expectedParent);

    if (targetLine === -1) {
      vscode.window.showWarningMessage(`Could not find node "${nodeName}" in file`);
      return;
    }

    await showLine(resource, document, targetLine, previewColumn);
  } catch (error) {
    showJumpFailure(error);
  }
}

/**
 * Open `resource` with the cursor on `line`, placed as `jumpToNodeDefinition` places it.
 * The Scene Tree view calls it with the line its entry was built from.
 */
export async function revealSceneLine(
  resource: vscode.Uri,
  line: number,
  previewColumn: vscode.ViewColumn | undefined
): Promise<void> {
  try {
    await showLine(resource, await vscode.workspace.openTextDocument(resource), line, previewColumn);
  } catch (error) {
    showJumpFailure(error);
  }
}

async function showLine(
  resource: vscode.Uri,
  document: vscode.TextDocument,
  line: number,
  previewColumn: vscode.ViewColumn | undefined
): Promise<void> {
  const editor = await vscode.window.showTextDocument(document, {
    viewColumn: columnHolding(resource, previewColumn) ?? freshColumn(previewColumn),
    preserveFocus: false,
  });

  const position = new vscode.Position(line, 0);
  const range = new vscode.Range(position, position);
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

function showJumpFailure(error: unknown): void {
  vscode.window.showErrorMessage(
    `Failed to jump to node: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}
