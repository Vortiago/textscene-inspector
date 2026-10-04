/**
 * The translation of the core language-feature results into LSP protocol shapes. Both sides
 * count positions from zero, so a range passes through unchanged; only the kind, the severity
 * and the edit container need a host-side spelling.
 */

import {
  CompletionItemKind,
  DiagnosticSeverity,
  DocumentHighlightKind,
  MarkupKind,
  type CodeAction as LspCodeAction,
  type CompletionItem as LspCompletionItem,
  type Diagnostic as LspDiagnostic,
  type DocumentHighlight as LspDocumentHighlight,
  type FoldingRange as LspFoldingRange,
  type Hover as LspHover,
  type Range as LspRange,
  type TextEdit as LspTextEdit,
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type {
  CodeAction,
  CompletionItem,
  CompletionKind,
  DocumentHighlight,
  FoldingRange,
  Hover,
  TextEdit,
} from '@textscene/core/languageFeatures';
import { diagnosticLine, flooredSeverity, type Diagnostic, type Severity } from '@textscene/core/linter';

const COMPLETION_KIND: Record<CompletionKind, CompletionItemKind> = {
  nodeType: CompletionItemKind.Class,
  resourceType: CompletionItemKind.Struct,
  property: CompletionItemKind.Property,
  value: CompletionItemKind.Value,
  resourceId: CompletionItemKind.Reference,
  path: CompletionItemKind.File,
  nodeName: CompletionItemKind.Variable,
};

const DIAGNOSTIC_SEVERITY: Record<Severity, DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
};

const ZERO_RANGE: LspRange = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
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
  const lspRange = { startLine: range.startLine, endLine: range.endLine };
  return range.kind === undefined ? lspRange : { ...lspRange, kind: range.kind };
}

/** Core highlight, as a text occurrence. */
export function toLspHighlight(highlight: DocumentHighlight): LspDocumentHighlight {
  return { range: highlight.range, kind: DocumentHighlightKind.Text };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The squiggle for a diagnostic. Core lines are one-based and clamped into the document; one
 * that names no line gets a zero-width range at the start, so a client lists it once without a
 * squiggle under line one's text.
 */
function diagnosticRange(diagnostic: Diagnostic, document: TextDocument): LspRange {
  const line = diagnosticLine(diagnostic);
  if (line === undefined) return ZERO_RANGE;

  const lineIndex = clamp(line - 1, 0, Math.max(document.lineCount - 1, 0));
  const lineLength = document.getLineRange(lineIndex).end.character;
  const column = diagnostic.location?.column;
  const start = typeof column === 'number' ? clamp(column - 1, 0, lineLength) : 0;
  return {
    start: { line: lineIndex, character: start },
    end: { line: lineIndex, character: Math.max(lineLength, start) },
  };
}

/** One core diagnostic, with a floored severity and its line clamped into the open document. */
export function toLspDiagnostic(diagnostic: Diagnostic, document: TextDocument): LspDiagnostic {
  return {
    range: diagnosticRange(diagnostic, document),
    severity: DIAGNOSTIC_SEVERITY[flooredSeverity(diagnostic.severity)],
    code: diagnostic.ruleName,
    source: 'tscn-lsp',
    message: diagnostic.message,
  };
}
