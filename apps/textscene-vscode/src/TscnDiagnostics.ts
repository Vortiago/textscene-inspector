/**
 * Surfaces core Linter diagnostics for open `.tscn` and `.tres` documents, through one lint session per document.
 * A change on disk to a file a document's last lint read re-lints that document. It imports
 * `@textscene/core/linter`, never the root index, to stay renderer-free.
 */

import * as vscode from 'vscode';
import {
  Linter,
  diagnosticLine,
  flooredSeverity,
  type Diagnostic as TscnLintDiagnostic,
  type LintSession,
} from '@textscene/core/linter';
import { isGodotTextResourcePath } from '@textscene/core/godot';
import { error as logError } from '@textscene/core/logger';
import { comparablePath, isWithinRoot } from '@textscene/core/resources/resPath';
import { LintResourceProvider } from './LintResourceProvider';
import { findEnclosingGodotProject, hasProjectFile } from './findGodotProjectRoot';
import { EXTENSION_LIST_PATTERN, PROJECT_FILE_PATTERN } from './watchPatterns';

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

/** The events of a file watcher, which `TscnDiagnostics` subscribes to and does not own. */
export type FileEvents = Pick<vscode.FileSystemWatcher, 'onDidChange' | 'onDidCreate' | 'onDidDelete'>;

/** Everything kept for one open document. */
interface DocumentLint {
  readonly session: LintSession;
  /** The pending debounced lint. */
  timer?: ReturnType<typeof setTimeout>;
  /** The project view, once the walk has answered: null for a document in no project. */
  provider?: LintResourceProvider | null;
  /** The walk in flight. A newer walk replaces it, and only the newest one lands. */
  walk?: symbol;
  /** What the collection shows for the document, so an equal list is not published again. */
  published?: readonly vscode.Diagnostic[];
}

function isSameRange(a: vscode.Range, b: vscode.Range): boolean {
  return (
    a.start.line === b.start.line &&
    a.start.character === b.start.character &&
    a.end.line === b.end.line &&
    a.end.character === b.end.character
  );
}

/**
 * Whether two lists show the same entries: code, severity, range and message, in order. The range, not the core line:
 * it ends at its line's current length, so an edit to a flagged line moves it while the core list stays equal.
 */
function isSameList(a: readonly vscode.Diagnostic[], b: readonly vscode.Diagnostic[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (d, i) =>
        d.code === b[i]!.code &&
        d.severity === b[i]!.severity &&
        isSameRange(d.range, b[i]!.range) &&
        d.message === b[i]!.message
    )
  );
}

export class TscnDiagnostics implements vscode.Disposable {
  private readonly _collection: vscode.DiagnosticCollection;
  private readonly _linter = new Linter();
  private readonly _disposables: vscode.Disposable[] = [];
  /** Each linted open document, by URI. Written by `lintDocument`, deleted on close, cleared by `_clearAll`. */
  private readonly _documents = new Map<string, DocumentLint>();
  /**
   * One provider per project root, so the documents of a project share its verdicts. Written by `_providerFor`,
   * cleared by `_clearAll`.
   */
  private readonly _providers = new Map<string, LintResourceProvider>();
  /**
   * Whether each directory holds `project.godot`, so the walks of a project's documents share their answers.
   * Written by `_holdsProjectFile`, cleared on any `project.godot` event and by `_clearAll`.
   */
  private readonly _projectFileByDir = new Map<string, Promise<boolean>>();
  private _enabled: boolean;
  private _debounceMs: number;

  /**
   * @param resourceFiles - The events of the extension's resource-file watcher, which the glTF files a lint reads
   *   are among
   */
  constructor(
    resourceFiles: FileEvents,
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
    this._subscribe(resourceFiles, (uri) => this._onDependencyChanged(uri));
    const extensionList = vscode.workspace.createFileSystemWatcher(EXTENSION_LIST_PATTERN);
    const projectFile = vscode.workspace.createFileSystemWatcher(PROJECT_FILE_PATTERN);
    this._disposables.push(extensionList, projectFile);
    this._subscribe(extensionList, (uri) => this._onDependencyChanged(uri));
    this._subscribe(projectFile, (uri) => this._onProjectFileChanged(uri));

    // Lint everything already open at activation, unless diagnostics are off.
    if (this._enabled) {
      for (const document of vscode.workspace.textDocuments) {
        this.lintDocument(document);
      }
    }
  }

  /**
   * Lint a document immediately and publish its diagnostics with the cross-file ones of its last read, then again
   * with the fresh cross-file ones, unless a newer lint has overtaken this one. A document linted before its project
   * walk has answered gets the file-local rules, and a full lint once it answers. No-op while disabled.
   */
  public lintDocument(document: vscode.TextDocument): void {
    if (!isTscnDocument(document) || !this._enabled) {
      return;
    }

    const record = this._recordOf(document);
    const { now, later } = record.session.lint(document.getText(), record.provider ?? null);
    this._publish(document, record, now);
    later
      ?.then((complete) => {
        if (complete && this._documents.get(document.uri.toString()) === record) {
          this._publish(document, record, complete);
        }
      })
      .catch((reason: unknown) => logError('[TscnDiagnostics] Cross-file lint failed:', reason));
    if (record.provider === undefined && record.walk === undefined) this._walk(document, record);
  }

  private _subscribe(events: FileEvents, handler: (uri: vscode.Uri) => void): void {
    this._disposables.push(events.onDidCreate(handler), events.onDidChange(handler), events.onDidDelete(handler));
  }

  /** Schedules a lint of each open document whose last lint read `uri`, debounced like an edit. */
  private _onDependencyChanged(uri: vscode.Uri): void {
    if (!this._enabled) return;
    const changed = comparablePath(uri.fsPath);
    for (const document of vscode.workspace.textDocuments) {
      const record = this._documents.get(document.uri.toString());
      const provider = record?.provider;
      if (!provider) continue;
      const read = record.session.reads.some((path) => {
        const file = provider.fileOf(path);
        return file !== null && comparablePath(file.fsPath) === changed;
      });
      if (read) this._scheduleLint(document);
    }
  }

  /**
   * Walks again for each open document under `uri`'s directory, the documents whose project the file roots or
   * would root, and lints each once its walk answers. A provider whose root is unchanged stays, verdicts included.
   */
  private _onProjectFileChanged(uri: vscode.Uri): void {
    if (!this._enabled) return;
    this._projectFileByDir.clear();
    const projectDir = vscode.Uri.joinPath(uri, '..').fsPath;
    for (const document of vscode.workspace.textDocuments) {
      if (!isTscnDocument(document) || !isWithinRoot(projectDir, document.uri.fsPath)) continue;
      const record = this._documents.get(document.uri.toString());
      if (record) this._walk(document, record);
    }
  }

  /** Finds `document`'s project, then lints it with that project's provider, unless the record is gone or walked again. */
  private _walk(document: vscode.TextDocument, record: DocumentLint): void {
    const walk = Symbol('walk');
    record.walk = walk;
    this._providerFor(document)
      .then((provider) => {
        if (record.walk !== walk || this._documents.get(document.uri.toString()) !== record) return;
        record.walk = undefined;
        record.provider = provider;
        this.lintDocument(document);
      })
      .catch((reason: unknown) => logError('[TscnDiagnostics] Project lookup failed:', reason));
  }

  /** The provider of the project `document` sits in, or null outside every workspace folder and every project. */
  private async _providerFor(document: vscode.TextDocument): Promise<LintResourceProvider | null> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return null;
    const root = await findEnclosingGodotProject(folder.uri, document.uri, (dir) => this._holdsProjectFile(dir));
    if (root === null) return null;
    const key = root.toString();
    let provider = this._providers.get(key);
    if (!provider) {
      provider = new LintResourceProvider(root);
      this._providers.set(key, provider);
    }
    return provider;
  }

  private _holdsProjectFile(dir: vscode.Uri): Promise<boolean> {
    const key = dir.toString();
    let answer = this._projectFileByDir.get(key);
    if (!answer) {
      answer = hasProjectFile(dir);
      this._projectFileByDir.set(key, answer);
    }
    return answer;
  }

  private _recordOf(document: vscode.TextDocument): DocumentLint {
    const key = document.uri.toString();
    let record = this._documents.get(key);
    if (!record) {
      record = { session: this._linter.session() };
      this._documents.set(key, record);
    }
    return record;
  }

  private _publish(
    document: vscode.TextDocument,
    record: DocumentLint,
    diagnostics: readonly TscnLintDiagnostic[]
  ): void {
    const shown = diagnostics.map((diagnostic) => toVsCodeDiagnostic(diagnostic, document));
    if (record.published && isSameList(record.published, shown)) return;
    record.published = shown;
    this._collection.set(document.uri, shown);
  }

  private _scheduleLint(document: vscode.TextDocument): void {
    if (!isTscnDocument(document) || !this._enabled) {
      return;
    }

    const record = this._recordOf(document);
    if (record.timer !== undefined) {
      clearTimeout(record.timer);
    }
    record.timer = setTimeout(() => {
      record.timer = undefined;
      this.lintDocument(document);
    }, this._debounceMs);
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
      this._clearAll();
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
    const record = this._documents.get(key);
    if (record?.timer !== undefined) clearTimeout(record.timer);
    this._documents.delete(key);
    this._collection.delete(document.uri);
  }

  /** Cancels every pending lint and forgets every document, provider and walk answer. */
  private _clearAll(): void {
    for (const record of this._documents.values()) {
      if (record.timer !== undefined) clearTimeout(record.timer);
    }
    this._documents.clear();
    this._providers.clear();
    this._projectFileByDir.clear();
  }

  public dispose(): void {
    this._clearAll();

    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }

    this._collection.dispose();
  }
}
