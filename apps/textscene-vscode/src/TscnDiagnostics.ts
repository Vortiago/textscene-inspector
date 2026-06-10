/**
 * Surfaces core Linter diagnostics for .tscn documents in the editor.
 *
 * Owns a DiagnosticCollection: lints all open .tscn documents on
 * activation, re-lints on open/save and on change (debounced), and
 * clears entries when a document closes.
 *
 * IMPORTANT: imports the React-free `@textscene/core/linter` subpath —
 * never the root `@textscene/core` index — so the linter stays out of
 * the renderer dependency graph.
 */

import * as vscode from 'vscode';
import { Linter, type Diagnostic as TscnLintDiagnostic } from '@textscene/core/linter';

const LINT_DEBOUNCE_MS = 300;

const SEVERITY_MAP: Record<TscnLintDiagnostic['severity'], vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

/** Minimal slice of `vscode.TextDocument` the mapping needs (testable without a full mock). */
export interface DocumentLineSource {
  lineCount: number;
  lineAt(line: number): { text: string };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Pure mapping: core linter diagnostic -> vscode.Diagnostic.
 *
 * Core locations are 1-based; vscode is 0-based. Out-of-range lines and
 * columns are clamped to the document; diagnostics without a location
 * land on line 0.
 */
export function toVsCodeDiagnostic(
  diagnostic: TscnLintDiagnostic,
  document: DocumentLineSource
): vscode.Diagnostic {
  const result = new vscode.Diagnostic(
    rangeForDiagnostic(diagnostic, document),
    diagnostic.message,
    SEVERITY_MAP[diagnostic.severity]
  );
  result.code = diagnostic.ruleName;
  result.source = 'tscn-lint';
  return result;
}

function rangeForDiagnostic(
  diagnostic: TscnLintDiagnostic,
  document: DocumentLineSource
): vscode.Range {
  const line = diagnostic.location?.line;
  if (typeof line !== 'number') {
    return new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
  }

  const lastLine = Math.max(document.lineCount - 1, 0);
  const lineIndex = clamp(line - 1, 0, lastLine);
  const lineLength = document.lineAt(lineIndex).text.length;

  const column = diagnostic.location?.column;
  const startCharacter =
    typeof column === 'number' ? clamp(column - 1, 0, lineLength) : 0;

  return new vscode.Range(
    new vscode.Position(lineIndex, startCharacter),
    new vscode.Position(lineIndex, Math.max(lineLength, startCharacter))
  );
}

function isTscnDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'tscn' || document.fileName.endsWith('.tscn');
}

export class TscnDiagnostics implements vscode.Disposable {
  private readonly _collection: vscode.DiagnosticCollection;
  private readonly _linter = new Linter();
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    collection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('tscn')
  ) {
    this._collection = collection;

    this._disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => this.lintDocument(document)),
      vscode.workspace.onDidSaveTextDocument((document) => this.lintDocument(document)),
      vscode.workspace.onDidChangeTextDocument((event) => this._scheduleLint(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => this._clearDocument(document))
    );

    // Lint everything already open at activation.
    for (const document of vscode.workspace.textDocuments) {
      this.lintDocument(document);
    }
  }

  /** Lint a document immediately and publish its diagnostics. */
  public lintDocument(document: vscode.TextDocument): void {
    if (!isTscnDocument(document)) {
      return;
    }

    const diagnostics = this._linter.lint(document.getText());
    this._collection.set(
      document.uri,
      diagnostics.map((diagnostic) => toVsCodeDiagnostic(diagnostic, document))
    );
  }

  private _scheduleLint(document: vscode.TextDocument): void {
    if (!isTscnDocument(document)) {
      return;
    }

    const key = document.uri.toString();
    const pending = this._debounceTimers.get(key);
    if (pending !== undefined) {
      clearTimeout(pending);
    }

    this._debounceTimers.set(
      key,
      setTimeout(() => {
        this._debounceTimers.delete(key);
        this.lintDocument(document);
      }, LINT_DEBOUNCE_MS)
    );
  }

  private _clearDocument(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const pending = this._debounceTimers.get(key);
    if (pending !== undefined) {
      clearTimeout(pending);
      this._debounceTimers.delete(key);
    }
    this._collection.delete(document.uri);
  }

  public dispose(): void {
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();

    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }

    this._collection.dispose();
  }
}
