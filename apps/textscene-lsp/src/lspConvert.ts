/**
 * The translation of the core language-feature results into LSP protocol shapes. Both sides
 * count positions from zero, so a range passes through unchanged. Only the kind, the severity
 * and the edit container need a host-side spelling.
 */

import {
  CompletionItemKind,
  DiagnosticSeverity,
  DocumentHighlightKind,
  FoldingRangeKind,
  MarkupKind,
  SymbolKind as LspSymbolKind,
  type CodeAction as LspCodeAction,
  type CompletionItem as LspCompletionItem,
  type Diagnostic as LspDiagnostic,
  type DocumentHighlight as LspDocumentHighlight,
  type DocumentSymbol as LspDocumentSymbol,
  type FoldingRange as LspFoldingRange,
  type Hover as LspHover,
  type TextEdit as LspTextEdit,
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type {
  CodeAction,
  CompletionItem,
  CompletionKind,
  DocumentHighlight,
  DocumentSymbol,
  FoldingRange,
  Hover,
  SymbolKind,
  TextEdit,
} from '@textscene/core/languageFeatures';
import { diagnosticRange, flooredSeverity, type Diagnostic, type Severity } from '@textscene/core/linter';

const COMPLETION_KIND: Record<CompletionKind, CompletionItemKind> = {
  nodeType: CompletionItemKind.Class,
  resourceType: CompletionItemKind.Struct,
  property: CompletionItemKind.Property,
  value: CompletionItemKind.Value,
  resourceId: CompletionItemKind.Reference,
  path: CompletionItemKind.File,
  nodeName: CompletionItemKind.Reference,
};

const SYMBOL_KIND: Record<SymbolKind, LspSymbolKind> = {
  object: LspSymbolKind.Object,
  class: LspSymbolKind.Class,
  struct: LspSymbolKind.Struct,
  module: LspSymbolKind.Module,
};

const DIAGNOSTIC_SEVERITY: Record<Severity, DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
};

/** One core completion, with its kind mapped and its label as the default insert text. */
export function toLspCompletion(item: CompletionItem): LspCompletionItem {
  return {
    label: item.label,
    kind: COMPLETION_KIND[item.kind],
    detail: item.detail,
    documentation: item.documentation,
    insertText: item.insertText ?? item.label,
    deprecated: item.deprecated,
  };
}

/** Core hover, as markdown. */
export function toLspHover(hover: Hover): LspHover {
  const contents = { kind: MarkupKind.Markdown, value: hover.markdown };
  return hover.range ? { contents, range: hover.range } : { contents };
}

function toLspTextEdit(edit: TextEdit): LspTextEdit {
  return { range: edit.range, newText: edit.newText };
}

/** One core quick fix, keyed to the document it edits. */
export function toLspCodeAction(action: CodeAction, uri: string): LspCodeAction {
  return {
    title: action.title,
    kind: 'quickfix',
    edit: { changes: { [uri]: action.edit.map(toLspTextEdit) } },
  };
}

/** Core folding range, as an LSP region. */
export function toLspFoldingRange(range: FoldingRange): LspFoldingRange {
  return { startLine: range.startLine, endLine: range.endLine, kind: FoldingRangeKind.Region };
}

/** Core outline symbol and its subtree. */
export function toLspSymbol(symbol: DocumentSymbol): LspDocumentSymbol {
  return {
    name: symbol.name,
    detail: symbol.detail,
    kind: SYMBOL_KIND[symbol.kind],
    range: symbol.range,
    selectionRange: symbol.selectionRange,
    children: symbol.children.map(toLspSymbol),
  };
}

/** Core highlight, as a text occurrence. */
export function toLspHighlight(highlight: DocumentHighlight): LspDocumentHighlight {
  return { range: highlight.range, kind: DocumentHighlightKind.Text };
}

/** One core diagnostic, with a floored severity, and its squiggle where core's `diagnosticRange` puts it. */
export function toLspDiagnostic(diagnostic: Diagnostic, document: TextDocument): LspDiagnostic {
  return {
    range: diagnosticRange(diagnostic, {
      lineCount: document.lineCount,
      lineLength: (line) => document.getLineRange(line).end.character,
    }),
    severity: DIAGNOSTIC_SEVERITY[flooredSeverity(diagnostic.severity)],
    code: diagnostic.ruleName,
    source: 'tscn-lsp',
    message: diagnostic.message,
  };
}
