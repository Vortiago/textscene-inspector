/** Tests for the core-to-LSP translations: kinds, severities and edit containers. */

import { describe, it, expect } from 'vitest';
import {
  CompletionItemKind,
  DiagnosticSeverity,
  DocumentHighlightKind,
  FoldingRangeKind,
  MarkupKind,
  SymbolKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { CodeAction, DocumentSymbol, Hover, Range } from '@textscene/core/languageFeatures';
import type { Diagnostic } from '@textscene/core/linter';
import {
  toLspCodeAction,
  toLspCompletion,
  toLspDiagnostic,
  toLspFoldingRange,
  toLspHighlight,
  toLspHover,
  toLspSymbol,
} from './lspConvert';

const TEXT = 'alpha\nsecond line\n';
const document = TextDocument.create('file:///scene.tscn', 'tscn', 1, TEXT);

function diagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    severity: 'warning',
    message: 'a finding',
    nodeName: 'Root',
    nodeType: 'Node3D',
    ruleName: 'a-rule',
    ...overrides,
  };
}

describe('toLspCompletion', () => {
  it('maps a node type to the class kind and defaults insertText to the label', () => {
    const item = toLspCompletion({ label: 'Node3D', kind: 'nodeType', detail: 'extends Node' });

    expect(item).toMatchObject({
      label: 'Node3D',
      kind: CompletionItemKind.Class,
      detail: 'extends Node',
      insertText: 'Node3D',
    });
  });

  it('turns the range an item replaces into a text edit', () => {
    const replaces = { start: { line: 1, character: 8 }, end: { line: 1, character: 18 } };
    const item = toLspCompletion({
      label: 'res://art/a.png',
      kind: 'path',
      insertText: 'res://art/a.png',
      replaces,
    });

    expect(item.textEdit).toEqual({ range: replaces, newText: 'res://art/a.png' });
  });

  it('gives an item with no range no text edit', () => {
    expect(toLspCompletion({ label: 'true', kind: 'value' }).textEdit).toBeUndefined();
  });

  it('keeps an explicit insertText and carries the deprecated mark', () => {
    const item = toLspCompletion({
      label: 'true',
      kind: 'value',
      insertText: '1',
      deprecated: true,
    });

    expect(item.kind).toBe(CompletionItemKind.Value);
    expect(item.insertText).toBe('1');
    expect(item.deprecated).toBe(true);
  });

  it('maps every remaining kind to its icon', () => {
    expect(toLspCompletion({ label: 'a', kind: 'resourceType' }).kind).toBe(CompletionItemKind.Struct);
    expect(toLspCompletion({ label: 'a', kind: 'property' }).kind).toBe(CompletionItemKind.Property);
    expect(toLspCompletion({ label: 'a', kind: 'resourceId' }).kind).toBe(CompletionItemKind.Reference);
    expect(toLspCompletion({ label: 'a', kind: 'path' }).kind).toBe(CompletionItemKind.File);
    expect(toLspCompletion({ label: 'a', kind: 'nodeName' }).kind).toBe(CompletionItemKind.Reference);
  });
});

describe('toLspHover', () => {
  it('renders markdown and keeps the range when the hover names one', () => {
    const range: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } };
    const hover: Hover = { markdown: '**Node3D**', range };

    expect(toLspHover(hover)).toEqual({
      contents: { kind: MarkupKind.Markdown, value: '**Node3D**' },
      range,
    });
  });

  it('omits the range for a whole-line answer', () => {
    expect(toLspHover({ markdown: '**Node3D**' })).toEqual({
      contents: { kind: MarkupKind.Markdown, value: '**Node3D**' },
    });
  });
});

describe('toLspCodeAction', () => {
  it('keys one edit set to the document that asked', () => {
    const range: Range = { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } };
    const action: CodeAction = {
      title: "Change 'visable' to 'visible'",
      edit: [{ range, newText: 'visible' }],
    };

    expect(toLspCodeAction(action, 'file:///scene.tscn')).toEqual({
      title: "Change 'visable' to 'visible'",
      kind: 'quickfix',
      edit: { changes: { 'file:///scene.tscn': [{ range, newText: 'visible' }] } },
    });
  });

  it('keeps every edit of one action', () => {
    const action: CodeAction = {
      title: 'two',
      edit: [
        { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: 'a' },
        { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } }, newText: 'b' },
      ],
    };

    expect(toLspCodeAction(action, 'file:///s.tscn').edit?.changes?.['file:///s.tscn']).toHaveLength(2);
  });
});

describe('toLspFoldingRange', () => {
  it('marks every fold a region', () => {
    expect(toLspFoldingRange({ startLine: 2, endLine: 6 })).toEqual({
      startLine: 2,
      endLine: 6,
      kind: FoldingRangeKind.Region,
    });
  });
});

describe('toLspSymbol', () => {
  it('maps the kind and keeps the ranges and the subtree', () => {
    const range: Range = { start: { line: 2, character: 0 }, end: { line: 9, character: 4 } };
    const heading: Range = { start: { line: 2, character: 0 }, end: { line: 2, character: 4 } };
    const leaf: DocumentSymbol = {
      name: 'Mesh',
      detail: 'MeshInstance3D',
      kind: 'class',
      range: heading,
      selectionRange: heading,
      children: [],
    };
    const root: DocumentSymbol = {
      name: 'Root',
      detail: 'Node3D',
      kind: 'module',
      range,
      selectionRange: heading,
      children: [leaf],
    };

    expect(toLspSymbol(root)).toEqual({
      name: 'Root',
      detail: 'Node3D',
      kind: SymbolKind.Module,
      range,
      selectionRange: heading,
      children: [
        {
          name: 'Mesh',
          detail: 'MeshInstance3D',
          kind: SymbolKind.Class,
          range: heading,
          selectionRange: heading,
          children: [],
        },
      ],
    });
  });
});

describe('toLspHighlight', () => {
  it('marks the span as a text occurrence', () => {
    const range: Range = { start: { line: 3, character: 4 }, end: { line: 3, character: 18 } };

    expect(toLspHighlight({ range })).toEqual({ range, kind: DocumentHighlightKind.Text });
  });
});

describe('toLspDiagnostic', () => {
  it('maps the severity, rule name and column to an LSP diagnostic', () => {
    const result = toLspDiagnostic(
      diagnostic({ severity: 'error', ruleName: 'strict-parser', location: { line: 2, column: 3 } }),
      document
    );

    expect(result.severity).toBe(DiagnosticSeverity.Error);
    expect(result.code).toBe('strict-parser');
    expect(result.source).toBe('tscn-lsp');
    expect(result.range).toEqual({
      start: { line: 1, character: 2 },
      end: { line: 1, character: 'second line'.length },
    });
  });

  it('floors an off-union severity to information', () => {
    const result = toLspDiagnostic(diagnostic({ severity: 'bogus' as Diagnostic['severity'] }), document);

    expect(result.severity).toBe(DiagnosticSeverity.Information);
  });

  it('gives a line-less diagnostic a zero-width range at the start', () => {
    const result = toLspDiagnostic(diagnostic(), document);

    expect(result.range).toEqual({ start: { line: 0, character: 0 }, end: { line: 0, character: 0 } });
  });

  it('clamps a line and column past the end of the document', () => {
    const result = toLspDiagnostic(diagnostic({ location: { line: 99, column: 500 } }), document);

    expect(result.range.start.line).toBe(document.lineCount - 1);
    expect(result.range.start.character).toBe(0);
  });
});
