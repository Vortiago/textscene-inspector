/**
 * Surfaces core Linter diagnostics for `.tscn` and `.tres` documents. It lints every
 * open document on activation, re-lints on open, save and change (debounced), and
 * clears a document's entries on close. It imports the React-free
 * `@textscene/core/linter` subpath, never the root index, to stay renderer-free.
 */

import * as vscode from 'vscode';
import { Linter, flooredSeverity, type Diagnostic as TscnLintDiagnostic } from '@textscene/core/linter';
import { isGodotTextResourcePath } from '@textscene/core/godot';

/** Fallback when `textscene.diagnostics.lintDebounceMs` is unset. */
export const DEFAULT_LINT_DEBOUNCE_MS = 300;

interface DiagnosticsConfig {
  enabled: boolean;
  debounceMs: number;
}

/** Reads the `textscene.diagnostics.*` settings, with their defaults. */
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
  info: vscode.DiagnosticSeverity.Information,
};

/**
 * The editor squiggle for a tier, an unranked one floored to Information. A bare
 * index hands `undefined` to `vscode.Diagnostic`, which defaults to Error, so a
 * malformed severity reads as the most severe thing in the file.
 */
function squiggleFor(severity: TscnLintDiagnostic['severity']): vscode.DiagnosticSeverity {
  return SEVERITY_MAP[flooredSeverity(severity)];
}

/** Minimal slice of `vscode.TextDocument` the mapping needs (testable without a full mock). */
export interface DocumentLineSource {
  lineCount: number;
  lineAt(line: number): { text: string };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * A core diagnostic as a `vscode.Diagnostic`. Core lines are 1-based and clamped into the
 * document. A diagnostic with no line is about the whole file: a zero-width range at the
 * document start lists it in the Problems panel and marks no text.
 */
export function toVsCodeDiagnostic(
  diagnostic: TscnLintDiagnostic,
  document: DocumentLineSource
): vscode.Diagnostic {
  const result = new vscode.Diagnostic(
    rangeForDiagnostic(diagnostic, document),
    diagnostic.message,
    squiggleFor(diagnostic.severity)
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
 * The `tscn` language claims `.tres` as well, so the languageId arm already
 * covers both; the filename arm is the fallback for a document whose
 * association a user has overridden, and it asks `godot/resourceFormats` so the
 * editor and the CLI walk answer the same question.
 */
function isTscnDocument(document: vscode.TextDocument): boolean {
  if (document.languageId === 'tscn') return true;
  return isGodotTextResourcePath(document.fileName);
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

    // Lint everything already open at activation, unless diagnostics are off.
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
   * Reacts to `textscene.diagnostics.*` changes. Disabling clears every diagnostic
   * and cancels pending lints at once, since waiting for the next edit leaves stale
   * Problems entries. Re-enabling re-lints every open document. A debounce change
   * takes effect on the next scheduled lint.
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
