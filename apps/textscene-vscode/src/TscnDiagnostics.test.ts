/**
 * Tests for TscnDiagnostics: the pure core-diagnostic -> vscode.Diagnostic
 * mapping and the lint-document flow against a mocked DiagnosticCollection.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import type { Diagnostic as TscnLintDiagnostic } from '@textscene/core/linter';
import {
  TscnDiagnostics,
  toVsCodeDiagnostic,
  DEFAULT_LINT_DEBOUNCE_MS,
  type DocumentLineSource,
} from './TscnDiagnostics';
import { createMockDiagnosticCollection, createMockUri } from './test-setup';

/** Configure the mocked `textscene` configuration section for one test. */
function mockDiagnosticsConfig(overrides: { enabled?: boolean; lintDebounceMs?: number } = {}): void {
  const enabled = overrides.enabled ?? true;
  const lintDebounceMs = overrides.lintDebounceMs ?? DEFAULT_LINT_DEBOUNCE_MS;
  (vscode.workspace.getConfiguration as Mock).mockReturnValue({
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'diagnostics.enabled') return enabled;
      if (key === 'diagnostics.lintDebounceMs') return lintDebounceMs;
      return defaultValue;
    }),
  });
}

// ============================================================================
// Helpers
// ============================================================================

function makeCoreDiagnostic(overrides: Partial<TscnLintDiagnostic> = {}): TscnLintDiagnostic {
  return {
    severity: 'error',
    message: 'Test message',
    nodeName: 'Root',
    nodeType: 'Node3D',
    ruleName: 'test-rule',
    ...overrides,
  };
}

function makeLineSource(content: string): DocumentLineSource {
  const lines = content.split('\n');
  return {
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] ?? '' }),
  };
}

function makeTscnDocument(content: string, fsPath = '/workspace/scene.tscn'): vscode.TextDocument {
  const lines = content.split('\n');
  return {
    uri: createMockUri(fsPath),
    fileName: fsPath,
    languageId: 'tscn',
    getText: () => content,
    lineCount: lines.length,
    lineAt: (lineOrPosition: number | vscode.Position) => {
      const line =
        typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
      return { text: lines[line] ?? '' };
    },
  } as unknown as vscode.TextDocument;
}

const VALID_TSCN = '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]';
const INVALID_TSCN = '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\nthis is not a property';

// ============================================================================
// toVsCodeDiagnostic (pure mapping)
// ============================================================================

describe('toVsCodeDiagnostic', () => {
  const doc = makeLineSource('first line\nsecond line longer\nthird');

  describe('severity mapping', () => {
    it('maps error to DiagnosticSeverity.Error', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ severity: 'error' }), doc);
      expect(result.severity).toBe(vscode.DiagnosticSeverity.Error);
    });

    it('maps warning to DiagnosticSeverity.Warning', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ severity: 'warning' }), doc);
      expect(result.severity).toBe(vscode.DiagnosticSeverity.Warning);
    });

    it('maps warning to DiagnosticSeverity.Warning (both severities covered)', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ severity: 'warning' }), doc);
      expect(result.severity).toBe(vscode.DiagnosticSeverity.Warning);
    });
  });

  describe('location mapping', () => {
    it('converts 1-based line/column to 0-based range spanning to end of line', () => {
      const result = toVsCodeDiagnostic(
        makeCoreDiagnostic({ location: { line: 2, column: 3 } }),
        doc
      );

      expect(result.range.start.line).toBe(1);
      expect(result.range.start.character).toBe(2);
      expect(result.range.end.line).toBe(1);
      expect(result.range.end.character).toBe('second line longer'.length);
    });

    it('falls back to a zero range at line 0 when location is missing', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic(), doc);

      expect(result.range.start.line).toBe(0);
      expect(result.range.start.character).toBe(0);
      expect(result.range.end.line).toBe(0);
      expect(result.range.end.character).toBe(0);
    });

    it('falls back to a zero range at line 0 when location has no line', () => {
      const result = toVsCodeDiagnostic(
        makeCoreDiagnostic({ location: { column: 5 } }),
        doc
      );

      expect(result.range.start.line).toBe(0);
      expect(result.range.start.character).toBe(0);
    });

    it('starts at column 0 when location has a line but no column', () => {
      const result = toVsCodeDiagnostic(
        makeCoreDiagnostic({ location: { line: 3 } }),
        doc
      );

      expect(result.range.start.line).toBe(2);
      expect(result.range.start.character).toBe(0);
      expect(result.range.end.character).toBe('third'.length);
    });

    it('clamps out-of-range lines to the last document line', () => {
      const result = toVsCodeDiagnostic(
        makeCoreDiagnostic({ location: { line: 999, column: 1 } }),
        doc
      );

      expect(result.range.start.line).toBe(2);
    });

    it('clamps out-of-range columns to the line length', () => {
      const result = toVsCodeDiagnostic(
        makeCoreDiagnostic({ location: { line: 3, column: 999 } }),
        doc
      );

      expect(result.range.start.character).toBe('third'.length);
      expect(result.range.end.character).toBe('third'.length);
    });

    it('clamps line/column zero to the document start', () => {
      const result = toVsCodeDiagnostic(
        makeCoreDiagnostic({ location: { line: 0, column: 0 } }),
        doc
      );

      expect(result.range.start.line).toBe(0);
      expect(result.range.start.character).toBe(0);
    });
  });

  describe('metadata', () => {
    it('sets the rule name as code and tscn-lint as source', () => {
      const result = toVsCodeDiagnostic(
        makeCoreDiagnostic({ ruleName: 'valid-node3d-visibility' }),
        doc
      );

      expect(result.code).toBe('valid-node3d-visibility');
      expect(result.source).toBe('tscn-lint');
      expect(result.message).toBe('Test message');
    });
  });
});

// ============================================================================
// TscnDiagnostics (lint-document flow)
// ============================================================================

describe('TscnDiagnostics', () => {
  let collection: ReturnType<typeof createMockDiagnosticCollection>;

  beforeEach(() => {
    collection = createMockDiagnosticCollection('tscn');
    (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [];
  });

  it('creates its own diagnostic collection when none is injected', () => {
    const diagnostics = new TscnDiagnostics();

    expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith('tscn');
    diagnostics.dispose();
  });

  it('lints already-open .tscn documents on construction', () => {
    const document = makeTscnDocument(INVALID_TSCN);
    (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [
      document,
    ];

    const diagnostics = new TscnDiagnostics(collection as unknown as vscode.DiagnosticCollection);

    expect(collection.set).toHaveBeenCalledTimes(1);
    const [uri, published] = collection.set.mock.calls[0]!;
    expect(uri).toBe(document.uri);
    expect((published as vscode.Diagnostic[]).length).toBeGreaterThan(0);
    expect((published as vscode.Diagnostic[])[0]!.source).toBe('tscn-lint');
    diagnostics.dispose();
  });

  it('publishes an empty diagnostics array for a clean document', () => {
    const diagnostics = new TscnDiagnostics(collection as unknown as vscode.DiagnosticCollection);
    const document = makeTscnDocument(VALID_TSCN);

    diagnostics.lintDocument(document);

    expect(collection.set).toHaveBeenCalledWith(document.uri, []);
    diagnostics.dispose();
  });

  it('ignores non-.tscn documents', () => {
    const diagnostics = new TscnDiagnostics(collection as unknown as vscode.DiagnosticCollection);
    const document = {
      ...makeTscnDocument(VALID_TSCN, '/workspace/readme.md'),
      languageId: 'markdown',
      fileName: '/workspace/readme.md',
    } as unknown as vscode.TextDocument;

    diagnostics.lintDocument(document);

    expect(collection.set).not.toHaveBeenCalled();
    diagnostics.dispose();
  });

  it('re-lints on open and on save via workspace events', () => {
    let openHandler: ((document: vscode.TextDocument) => void) | undefined;
    let saveHandler: ((document: vscode.TextDocument) => void) | undefined;
    (vscode.workspace.onDidOpenTextDocument as Mock).mockImplementation((handler) => {
      openHandler = handler;
      return { dispose: vi.fn() };
    });
    (vscode.workspace.onDidSaveTextDocument as Mock).mockImplementation((handler) => {
      saveHandler = handler;
      return { dispose: vi.fn() };
    });

    const diagnostics = new TscnDiagnostics(collection as unknown as vscode.DiagnosticCollection);
    const document = makeTscnDocument(VALID_TSCN);

    openHandler!(document);
    expect(collection.set).toHaveBeenCalledTimes(1);

    saveHandler!(document);
    expect(collection.set).toHaveBeenCalledTimes(2);
    diagnostics.dispose();
  });

  it('debounces change events (~300ms) into a single lint', () => {
    vi.useFakeTimers();
    try {
      let changeHandler:
        | ((event: { document: vscode.TextDocument }) => void)
        | undefined;
      (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
        changeHandler = handler;
        return { dispose: vi.fn() };
      });

      const diagnostics = new TscnDiagnostics(
        collection as unknown as vscode.DiagnosticCollection
      );
      const document = makeTscnDocument(VALID_TSCN);

      changeHandler!({ document });
      changeHandler!({ document });
      changeHandler!({ document });
      expect(collection.set).not.toHaveBeenCalled();

      vi.advanceTimersByTime(299);
      expect(collection.set).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(collection.set).toHaveBeenCalledTimes(1);
      diagnostics.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears diagnostics and pending lints when a document closes', () => {
    vi.useFakeTimers();
    try {
      let changeHandler:
        | ((event: { document: vscode.TextDocument }) => void)
        | undefined;
      let closeHandler: ((document: vscode.TextDocument) => void) | undefined;
      (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
        changeHandler = handler;
        return { dispose: vi.fn() };
      });
      (vscode.workspace.onDidCloseTextDocument as Mock).mockImplementation((handler) => {
        closeHandler = handler;
        return { dispose: vi.fn() };
      });

      const diagnostics = new TscnDiagnostics(
        collection as unknown as vscode.DiagnosticCollection
      );
      const document = makeTscnDocument(VALID_TSCN);

      changeHandler!({ document });
      closeHandler!(document);

      expect(collection.delete).toHaveBeenCalledWith(document.uri);

      // The pending debounced lint must have been cancelled.
      vi.advanceTimersByTime(1000);
      expect(collection.set).not.toHaveBeenCalled();
      diagnostics.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('disposes listeners, timers, and the collection', () => {
    vi.useFakeTimers();
    try {
      const disposeSpies = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
      let spyIndex = 0;
      const nextDisposable = () => ({ dispose: disposeSpies[spyIndex++]! });
      let changeHandler:
        | ((event: { document: vscode.TextDocument }) => void)
        | undefined;
      (vscode.workspace.onDidOpenTextDocument as Mock).mockImplementation(() => nextDisposable());
      (vscode.workspace.onDidSaveTextDocument as Mock).mockImplementation(() => nextDisposable());
      (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
        changeHandler = handler;
        return nextDisposable();
      });
      (vscode.workspace.onDidCloseTextDocument as Mock).mockImplementation(() => nextDisposable());

      const diagnostics = new TscnDiagnostics(
        collection as unknown as vscode.DiagnosticCollection
      );
      changeHandler!({ document: makeTscnDocument(VALID_TSCN) });

      diagnostics.dispose();

      for (const spy of disposeSpies) {
        expect(spy).toHaveBeenCalledTimes(1);
      }
      expect(collection.dispose).toHaveBeenCalledTimes(1);

      // The pending debounced lint must not fire after dispose.
      vi.advanceTimersByTime(1000);
      expect(collection.set).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  describe('textscene.diagnostics.* configuration', () => {
    // Earlier tests in this file override `onDidOpenTextDocument` et al. via
    // `.mockImplementation` to capture a handler; `vi.clearAllMocks()` (the
    // shared `afterEach` in test-setup.ts) clears CALLS but not those
    // implementations, so a later test would otherwise inherit a stale one.
    // Reset all five to a plain pass-through disposable before each test
    // here; individual tests still override whichever handler they need to
    // capture afterward.
    beforeEach(() => {
      (vscode.workspace.onDidOpenTextDocument as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      (vscode.workspace.onDidSaveTextDocument as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      (vscode.workspace.onDidCloseTextDocument as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
    });

    it('does not lint already-open documents on construction when diagnostics.enabled is false', () => {
      mockDiagnosticsConfig({ enabled: false });
      const document = makeTscnDocument(VALID_TSCN);
      (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [
        document,
      ];

      const diagnostics = new TscnDiagnostics(collection as unknown as vscode.DiagnosticCollection);

      expect(collection.set).not.toHaveBeenCalled();
      diagnostics.dispose();
    });

    it('ignores open/save/change requests while disabled', () => {
      mockDiagnosticsConfig({ enabled: false });
      let openHandler: ((document: vscode.TextDocument) => void) | undefined;
      (vscode.workspace.onDidOpenTextDocument as Mock).mockImplementation((handler) => {
        openHandler = handler;
        return { dispose: vi.fn() };
      });

      const diagnostics = new TscnDiagnostics(collection as unknown as vscode.DiagnosticCollection);
      openHandler!(makeTscnDocument(VALID_TSCN));

      expect(collection.set).not.toHaveBeenCalled();
      diagnostics.dispose();
    });

    it('uses the configured lintDebounceMs instead of the 300ms default', () => {
      mockDiagnosticsConfig({ lintDebounceMs: 1000 });
      vi.useFakeTimers();
      try {
        let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
        (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
          changeHandler = handler;
          return { dispose: vi.fn() };
        });

        const diagnostics = new TscnDiagnostics(
          collection as unknown as vscode.DiagnosticCollection
        );
        const document = makeTscnDocument(VALID_TSCN);

        changeHandler!({ document });

        vi.advanceTimersByTime(300);
        expect(collection.set).not.toHaveBeenCalled();

        vi.advanceTimersByTime(700);
        expect(collection.set).toHaveBeenCalledTimes(1);
        diagnostics.dispose();
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears all diagnostics and cancels pending lints when disabled mid-session', () => {
      mockDiagnosticsConfig({ enabled: true });
      vi.useFakeTimers();
      try {
        let configHandler: ((event: vscode.ConfigurationChangeEvent) => void) | undefined;
        let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
        (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation((handler) => {
          configHandler = handler;
          return { dispose: vi.fn() };
        });
        (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
          changeHandler = handler;
          return { dispose: vi.fn() };
        });

        const diagnostics = new TscnDiagnostics(
          collection as unknown as vscode.DiagnosticCollection
        );
        const document = makeTscnDocument(VALID_TSCN);
        changeHandler!({ document });

        mockDiagnosticsConfig({ enabled: false });
        configHandler!({ affectsConfiguration: (section: string) => section === 'textscene.diagnostics' });

        expect(collection.clear).toHaveBeenCalledTimes(1);

        // The pending debounced lint from before the toggle must not fire.
        vi.advanceTimersByTime(1000);
        expect(collection.set).not.toHaveBeenCalled();
        diagnostics.dispose();
      } finally {
        vi.useRealTimers();
      }
    });

    it('re-lints open documents when re-enabled mid-session', () => {
      mockDiagnosticsConfig({ enabled: false });
      let configHandler: ((event: vscode.ConfigurationChangeEvent) => void) | undefined;
      (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation((handler) => {
        configHandler = handler;
        return { dispose: vi.fn() };
      });
      const document = makeTscnDocument(VALID_TSCN);
      (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [
        document,
      ];

      const diagnostics = new TscnDiagnostics(collection as unknown as vscode.DiagnosticCollection);
      expect(collection.set).not.toHaveBeenCalled();

      mockDiagnosticsConfig({ enabled: true });
      configHandler!({ affectsConfiguration: (section: string) => section === 'textscene.diagnostics' });

      expect(collection.set).toHaveBeenCalledWith(document.uri, []);
      diagnostics.dispose();
    });

    it('ignores configuration changes unrelated to textscene.diagnostics', () => {
      mockDiagnosticsConfig({ enabled: true });
      let configHandler: ((event: vscode.ConfigurationChangeEvent) => void) | undefined;
      (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation((handler) => {
        configHandler = handler;
        return { dispose: vi.fn() };
      });

      const diagnostics = new TscnDiagnostics(collection as unknown as vscode.DiagnosticCollection);
      configHandler!({ affectsConfiguration: () => false });

      expect(collection.clear).not.toHaveBeenCalled();
      diagnostics.dispose();
    });
  });
});
