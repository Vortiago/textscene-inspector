/**
 * The Scene Tree view's data: the node tree of one scene document, built from the same
 * symbols as the Outline.
 */

import * as vscode from 'vscode';
import { TscnDocumentSymbolProvider } from '../TscnDocumentSymbolProvider';

/** Opens the scene's text with the cursor on a node's heading. Takes the scene `Uri` and a 0-based line. */
export const REVEAL_SCENE_NODE_COMMAND = 'textscene.revealSceneNode';

export class SceneTreeProvider implements vscode.TreeDataProvider<vscode.DocumentSymbol> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;
  private readonly _symbols = new TscnDocumentSymbolProvider();
  /** Written only by `show`. Undefined while no scene is active. */
  private _document: vscode.TextDocument | undefined;

  public get document(): vscode.TextDocument | undefined {
    return this._document;
  }

  /** Shows `document`'s node tree, or an empty view for `undefined`. */
  public show(document: vscode.TextDocument | undefined): void {
    this._document = document;
    this._onDidChangeTreeData.fire();
  }

  public getChildren(symbol?: vscode.DocumentSymbol): vscode.DocumentSymbol[] {
    if (symbol) return symbol.children;
    return this._document ? this._symbols.provideDocumentSymbols(this._document) : [];
  }

  public getTreeItem(symbol: vscode.DocumentSymbol): vscode.TreeItem {
    const item = new vscode.TreeItem(
      symbol.name,
      symbol.children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    item.description = symbol.detail;
    // The Outline's own codicon for the kind: `SymbolKind` is a numeric enum, so it maps back to its name.
    item.iconPath = new vscode.ThemeIcon(`symbol-${vscode.SymbolKind[symbol.kind].toLowerCase()}`);
    if (this._document) {
      item.command = {
        command: REVEAL_SCENE_NODE_COMMAND,
        title: 'Go to Node',
        arguments: [this._document.uri, symbol.selectionRange.start.line],
      };
    }
    return item;
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
