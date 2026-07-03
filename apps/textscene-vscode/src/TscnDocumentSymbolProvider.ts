/**
 * Provides document symbols for TSCN files, enabling Outline view and breadcrumbs.
 */

import * as vscode from 'vscode';
import { TscnParser, type TscnNode } from '@textscene/core/parser';
import { error } from '@textscene/core/logger';
import { findNodeHeadingLine } from './nodeHeadingResolver';

export class TscnDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  private readonly nodeTypeToSymbolKind: Record<string, vscode.SymbolKind> = {
    'MeshInstance3D': vscode.SymbolKind.Class,
    'Camera3D': vscode.SymbolKind.Struct,
    'SpotLight3D': vscode.SymbolKind.Object,
    'DirectionalLight3D': vscode.SymbolKind.Object,
    'OmniLight3D': vscode.SymbolKind.Object,
    'Node3D': vscode.SymbolKind.Module,
  };

  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    try {
      // Parse TSCN file
      const parser = new TscnParser();
      const parsed = parser.parse(document.getText());

      if (!parsed.nodes || parsed.nodes.length === 0) {
        return [];
      }

      // Convert each root node to DocumentSymbol
      return parsed.nodes.map(node =>
        this.convertNodeToSymbol(node, document)
      );
    } catch (err) {
      error('Error providing document symbols:', err);
      return [];
    }
  }

  private convertNodeToSymbol(
    node: TscnNode,
    document: vscode.TextDocument
  ): vscode.DocumentSymbol {
    const { range, selectionRange } = this.findNodeRange(
      document,
      node.name,
      node.parent
    );

    const symbolKind = this.getSymbolKind(node.type);

    const symbol = new vscode.DocumentSymbol(
      node.name,           // Symbol name
      node.type,           // Detail (node type)
      symbolKind,          // Visual kind
      range,               // Full range
      selectionRange       // Selection range
    );

    // Recursively add children
    if (node.children && node.children.length > 0) {
      symbol.children = node.children.map(child =>
        this.convertNodeToSymbol(child, document)
      );
    }

    return symbol;
  }

  private getSymbolKind(nodeType: string): vscode.SymbolKind {
    return this.nodeTypeToSymbolKind[nodeType] ?? vscode.SymbolKind.Object;
  }

  private findNodeRange(
    document: vscode.TextDocument,
    nodeName: string,
    nodeParent: string | undefined
  ): {
    range: vscode.Range;
    selectionRange: vscode.Range;
  } {
    const text = document.getText();
    const lines = text.split('\n');

    // Match by name and the exact Godot `parent=` value (root's heading omits
    // `parent`; compare it as an empty string) — disambiguates duplicate
    // sibling names, including nested ones sharing an immediate parent name.
    const startLine = findNodeHeadingLine(lines, nodeName, nodeParent ?? '');

    // Fallback if not found
    if (startLine === -1) {
      const fallbackRange = new vscode.Range(0, 0, 0, 0);
      return {
        range: fallbackRange,
        selectionRange: fallbackRange,
      };
    }

    // Selection range is the heading line
    const selectionRange = new vscode.Range(
      startLine,
      0,
      startLine,
      lines[startLine]!.length
    );

    // Full range extends until next node/resource or EOF
    let endLine = lines.length - 1;
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith('[node ') ||
          line.startsWith('[sub_resource') ||
          line.startsWith('[ext_resource')) {
        endLine = i - 1;
        break;
      }
    }

    const range = new vscode.Range(
      startLine,
      0,
      endLine,
      lines[endLine]?.length ?? 0
    );

    return { range, selectionRange };
  }
}
