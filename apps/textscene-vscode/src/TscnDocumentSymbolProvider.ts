/**
 * Provides document symbols for TSCN files: the Outline view, the breadcrumbs and the
 * Scene Tree view.
 */

import * as vscode from 'vscode';
import { TscnParser, type TscnNode } from '@textscene/core/parser';
import { error } from '@textscene/core/logger';
import { findNodeHeadingLine } from './nodeHeadingResolver';

export class TscnDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  private readonly nodeTypeToSymbolKind: Record<string, vscode.SymbolKind> = {
    MeshInstance3D: vscode.SymbolKind.Class,
    Camera3D: vscode.SymbolKind.Struct,
    SpotLight3D: vscode.SymbolKind.Object,
    DirectionalLight3D: vscode.SymbolKind.Object,
    OmniLight3D: vscode.SymbolKind.Object,
    Node3D: vscode.SymbolKind.Module,
  };

  /** The node tree under the root node. Empty for a scene with no nodes or one that fails to parse. */
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    try {
      const text = document.getText();
      const parsed = new TscnParser().parse(text);

      if (!parsed.nodes || parsed.nodes.length === 0) {
        return [];
      }

      // Split once: every node's range lookup scans the same lines.
      const lines = text.split('\n');
      return parsed.nodes.map((node) => this.convertNodeToSymbol(node, lines));
    } catch (err) {
      error('Error providing document symbols:', err);
      return [];
    }
  }

  private convertNodeToSymbol(node: TscnNode, lines: string[]): vscode.DocumentSymbol {
    const { range, selectionRange } = this.findNodeRange(lines, node.name, node.parent);

    const symbolKind = this.getSymbolKind(node.type);

    const symbol = new vscode.DocumentSymbol(
      node.name,
      node.type, // detail
      symbolKind,
      range,
      selectionRange
    );

    if (node.children && node.children.length > 0) {
      symbol.children = node.children.map((child) => this.convertNodeToSymbol(child, lines));
    }

    return symbol;
  }

  private getSymbolKind(nodeType: string): vscode.SymbolKind {
    return this.nodeTypeToSymbolKind[nodeType] ?? vscode.SymbolKind.Object;
  }

  private findNodeRange(
    lines: string[],
    nodeName: string,
    nodeParent: string | undefined
  ): {
    range: vscode.Range;
    selectionRange: vscode.Range;
  } {
    // Match by name and the exact `parent=` value, which tells duplicate sibling
    // names apart. The root's heading omits `parent`, so it compares as ''.
    const startLine = findNodeHeadingLine(lines, nodeName, nodeParent ?? '');

    if (startLine === -1) {
      const fallbackRange = new vscode.Range(0, 0, 0, 0);
      return {
        range: fallbackRange,
        selectionRange: fallbackRange,
      };
    }

    // The selection range is the heading line.
    const selectionRange = new vscode.Range(startLine, 0, startLine, lines[startLine]!.length);

    // The full range runs to the next node or resource heading, or EOF.
    let endLine = lines.length - 1;
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith('[node ') || line.startsWith('[sub_resource') || line.startsWith('[ext_resource')) {
        endLine = i - 1;
        break;
      }
    }

    const range = new vscode.Range(startLine, 0, endLine, lines[endLine]?.length ?? 0);

    return { range, selectionRange };
  }
}
