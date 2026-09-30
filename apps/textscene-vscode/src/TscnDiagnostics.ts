/**
 * Surfaces core Linter diagnostics for open `.tscn` and `.tres` documents. It publishes
 * a document's own diagnostics at once, beside the cross-file ones of its last lint,
 * and again once the files the scene uses are read. A change on disk to a file the
 * cross-file rules read re-lints the open documents of its workspace folder. It imports
 * `@textscene/core/linter`, never the root index, to stay renderer-free.
 */

import * as vscode from 'vscode';
import {
  Linter,
  diagnosticLine,
  flooredSeverity,
  mergeDiagnostics,
  type Diagnostic as TscnLintDiagnostic,
} from '@textscene/core/linter';
import { isGodotTextResourcePath } from '@textscene/core/godot';
import { error as logError } from '@textscene/core/logger';
import { LintResourceProvider } from './LintResourceProvider';

/** Fallback when `textscene.diagnostics.lintDebounceMs` is unset. */
export const DEFAULT_LINT_DEBOUNCE_MS = 300;

/**
 * The files the cross-file rules read besides the scene: a glTF (either case, since the importer
 * matches case-insensitively and a watcher glob does not), the project file and the GDExtension
 * list, in the hidden data directory or the plain one.
 */
const PROJECT_FILE_PATTERN = '**/project.godot';
const DEPENDENCY_FILE_PATTERNS = [
  '**/*.{glb,gltf,GLB,GLTF}',
  PROJECT_FILE_PATTERN,
  '**/{.godot,godot}/extension_list.cfg',
] as const;

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
 * document. One that names no line (`diagnosticLine`) is about the whole file, so it gets a
 * zero-width range at the document start: the Problems panel lists it at Ln 1, Col 1, and the
 * editor draws a collapsed marker there, not a squiggle under line 1's text.
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
  const line = diagnosticLine(diagnostic);
  if (line === undefined) {
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
  /**
   * The latest lint request per document URI. Written by `lintDocument`, deleted on
   * close and cleared on disable and dispose. A fresh token, not `document.version`: a
   * save re-lints the same version, and a dependency may have changed on disk since.
   */
  private readonly _latestRequests = new Map<string, symbol>();
  /**
   * The linter's project view per document URI, so its project-root walk runs once.
   * Written by `_providerFor`, deleted on close and on a change to its folder's
   * `project.godot`, and cleared on disable and dispose.
   */
  private readonly _providers = new Map<string, LintResourceProvider>();
  /**
   * The cross-file diagnostics of each document's last lint that read a file, shown
   * beside the file-local ones while the next read is pending, so they do not vanish
   * on each edit. Written when a read lands, deleted when a lint reads no file, on
   * close, and cleared on disable and dispose.
   */
  private readonly _crossFile = new Map<string, TscnLintDiagnostic[]>();
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
    for (const pattern of DEPENDENCY_FILE_PATTERNS) this._watchDependencyFiles(pattern);

    // Lint everything already open at activation, unless diagnostics are off.
    if (this._enabled) {
      for (const document of vscode.workspace.textDocuments) {
        this.lintDocument(document);
      }
    }
  }

  /**
   * Lint a document immediately and publish its diagnostics with the cross-file ones of
   * its last lint, then again with the fresh cross-file ones, unless a newer request has
   * overtaken this one. No-op while diagnostics are disabled.
   */
  public lintDocument(document: vscode.TextDocument): void {
    if (!isTscnDocument(document) || !this._enabled) {
      return;
    }

    const key = document.uri.toString();
    const request = Symbol(key);
    this._latestRequests.set(key, request);
    const text = document.getText();
    const provider = this._providerFor(document);
    const { diagnostics, dependencies } = provider
      ? this._linter.lintProject(text, provider)
      : { diagnostics: this._linter.lint(text), dependencies: null };
    if (!dependencies) {
      this._crossFile.delete(key);
      this._publish(document, diagnostics);
      return;
    }

    this._publish(document, mergeDiagnostics(diagnostics, this._crossFile.get(key) ?? []));
    dependencies
      .then((crossFile) => {
        if (this._latestRequests.get(key) !== request) return;
        this._crossFile.set(key, crossFile);
        this._publish(document, mergeDiagnostics(diagnostics, crossFile));
      })
      .catch((reason: unknown) => logError('[TscnDiagnostics] Cross-file lint failed:', reason));
  }

  /** Re-lints the open documents of a folder whenever a file matching `pattern` is created, changed or deleted. */
  private _watchDependencyFiles(pattern: string): void {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const onChange = (uri: vscode.Uri) => this._onDependencyFileChanged(uri, pattern === PROJECT_FILE_PATTERN);
    this._disposables.push(
      watcher,
      watcher.onDidCreate(onChange),
      watcher.onDidChange(onChange),
      watcher.onDidDelete(onChange)
    );
  }

  /**
   * Schedules a lint of each open document in `uri`'s workspace folder, debounced like an
   * edit. A changed `project.godot` may move a document's project root, so the folder's
   * providers go too, and their verdicts with them.
   */
  private _onDependencyFileChanged(uri: vscode.Uri, isProjectFile: boolean): void {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return;
    const folderKey = folder.uri.toString();
    if (isProjectFile) {
      for (const [key, provider] of this._providers) {
        if (provider.workspaceRoot.toString() === folderKey) this._providers.delete(key);
      }
    }
    for (const document of vscode.workspace.textDocuments) {
      if (vscode.workspace.getWorkspaceFolder(document.uri)?.uri.toString() === folderKey) {
        this._scheduleLint(document);
      }
    }
  }

  private _publish(document: vscode.TextDocument, diagnostics: readonly TscnLintDiagnostic[]): void {
    this._collection.set(
      document.uri,
      diagnostics.map((diagnostic) => toVsCodeDiagnostic(diagnostic, document))
    );
  }

  /** The project view `document`'s `res://` paths resolve in, or null outside every workspace folder. */
  private _providerFor(document: vscode.TextDocument): LintResourceProvider | null {
    const key = document.uri.toString();
    const cached = this._providers.get(key);
    if (cached) return cached;
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return null;
    const provider = new LintResourceProvider(folder.uri, document.uri);
    this._providers.set(key, provider);
    return provider;
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
      this._latestRequests.clear();
      this._providers.clear();
      this._crossFile.clear();
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
    this._latestRequests.delete(key);
    this._providers.delete(key);
    this._crossFile.delete(key);
    this._collection.delete(document.uri);
  }

  public dispose(): void {
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();
    this._latestRequests.clear();
    this._providers.clear();
    this._crossFile.clear();

    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }

    this._collection.dispose();
  }
}
