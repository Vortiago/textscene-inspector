/**
 * The Outline view, the breadcrumbs and the Scene Tree view for `.tscn` files: the scene
 * tree from the language-feature engine, so each matches the `tscn-lsp` server's outline.
 */

import * as vscode from 'vscode';
import { documentSymbols, type DocumentSymbol, type SymbolKind } from '@textscene/core/languageFeatures';
import { languageDocumentOf } from './languageDocumentOf';
import { toVscodeRange } from './languageFeatureRanges';

const SYMBOL_KIND: Record<SymbolKind, vscode.SymbolKind> = {
  object: vscode.SymbolKind.Object,
  class: vscode.SymbolKind.Class,
  struct: vscode.SymbolKind.Struct,
  module: vscode.SymbolKind.Module,
};

function toVscodeSymbol(symbol: DocumentSymbol): vscode.DocumentSymbol {
  const converted = new vscode.DocumentSymbol(
    symbol.name,
    symbol.detail,
    SYMBOL_KIND[symbol.kind],
    toVscodeRange(symbol.range),
    toVscodeRange(symbol.selectionRange)
  );
  converted.children = symbol.children.map(toVscodeSymbol);
  return converted;
}

export class TscnDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    return documentSymbols(languageDocumentOf(document)).map(toVscodeSymbol);
  }
}
