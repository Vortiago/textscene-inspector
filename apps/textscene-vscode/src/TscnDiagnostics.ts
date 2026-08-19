/**
 * Surfaces core Linter diagnostics for Godot text documents in the editor —
 * `.tscn` scenes and `.tres` resources alike.
 *
 * Owns a DiagnosticCollection: lints all open Godot text documents on
 * activation, re-lints on open/save and on change (debounced), and
 * clears entries when a document closes.
 *
 * IMPORTANT: imports the React-free `@textscene/core/linter` subpath —
 * never the root `@textscene/core` index — so the linter stays out of
 * the renderer dependency graph.
 */

import * as vscode from 'vscode';
import { Linter, type Diagnostic as TscnLintDiagnostic } from '@textscene/core/linter';

/** Fallback when `textscene.diagnostics.lintDebounceMs` is unset. */
export const DEFAULT_LINT_DEBOUNCE_MS = 300;

interface DiagnosticsConfig {
  enabled: boolean;
  debounceMs: number;
}

/** Read the `textscene.diagnostics.*` settings, defaulting to today's fixed behavior. */
function readDiagnosticsConfig(): DiagnosticsConfig {
  const config = vscode.workspace.getConfiguration('textscene');
  return {
    enabled: config.get<boolean>('diagnostics.enabled', true),
    debounceMs: config.get<number>('diagnostics.lintDebounceMs', DEFAULT_LINT_DEBOUNCE_MS),
  };
}

const SEVERITY_MAP: Record<TscnLintDiagnostic['severity'], vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
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

/**
 * Both text formats the linter takes. The `tscn` language claims `.tres` as
 * well, so the languageId arm already covers one; the filename arm is the
 * fallback for a document whose association a user has overridden.
 */
function isTscnDocument(document: vscode.TextDocument): boolean {
  if (document.languageId === 'tscn') return true;
  return document.fileName.endsWith('.tscn') || document.fileName.endsWith('.tres');
}

export class TscnDiagnostics implements vscode.Disposable {
  private readonly _collection: vscode.DiagnosticCollection;
  private readonly _linter = new Linter();
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private _enabled: boolean;
  private _debounceMs: number;

  constructor(
    collection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('tscn')
  ) {
    this._collection = collection;

    const config = readDiagnosticsConfig();
    this._enabled = config.enabled;
    this._debounceMs = config.debounceMs;

    this._disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => this.lintDocument(document)),
      vscode.workspace.onDidSaveTextDocument((document) => this.lintDocument(document)),
      vscode.workspace.onDidChangeTextDocument((event) => this._scheduleLint(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => this._clearDocument(document)),
      vscode.workspace.onDidChangeConfiguration((event) => this._onConfigurationChanged(event))
    );

    // Lint everything already open at activation — unless the user turned
    // diagnostics off, in which case there is nothing to publish.
    if (this._enabled) {
      for (const document of vscode.workspace.textDocuments) {
        this.lintDocument(document);
      }
    }
  }

  /** Lint a document immediately and publish its diagnostics. No-op while diagnostics are disabled. */
  public lintDocument(document: vscode.TextDocument): void {
    if (!isTscnDocument(document) || !this._enabled) {
      return;
    }

    const diagnostics = this._linter.lint(document.getText());
    this._collection.set(
      document.uri,
      diagnostics.map((diagnostic) => toVsCodeDiagnostic(diagnostic, document))
    );
  }

  private _scheduleLint(document: vscode.TextDocument): void {
    if (!isTscnDocument(document) || !this._enabled) {
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
      }, this._debounceMs)
    );
  }

  /**
   * React to `textscene.diagnostics.*` setting changes. Disabling clears every
   * published diagnostic and cancels pending debounced lints immediately —
   * waiting for the next edit/save would leave stale Problems-panel entries
   * around. Re-enabling re-lints every currently-open document, matching
   * construction-time behavior. A debounce-only change just takes effect on
   * the next scheduled lint; nothing to do here for that case.
   */
  private _onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
    if (!event.affectsConfiguration('textscene.diagnostics')) {
      return;
    }

    const wasEnabled = this._enabled;
    const config = readDiagnosticsConfig();
    this._enabled = config.enabled;
    this._debounceMs = config.debounceMs;

    if (!this._enabled) {
      for (const timer of this._debounceTimers.values()) {
        clearTimeout(timer);
      }
      this._debounceTimers.clear();
      this._collection.clear();
      return;
    }

    if (!wasEnabled) {
      for (const document of vscode.workspace.textDocuments) {
        this.lintDocument(document);
      }
    }
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
