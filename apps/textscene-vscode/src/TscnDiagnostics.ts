/**
 * Surfaces core Linter diagnostics for open `.tscn` and `.tres` documents, through one lint session per document.
 * A change on disk to a file a document's last lint read re-lints that document. It imports
 * `@textscene/core/linter`, never the root index, to stay renderer-free.
 */

import * as vscode from 'vscode';
import {
  Linter,
  diagnosticRange,
  flooredSeverity,
  type Diagnostic as TscnLintDiagnostic,
  type LintSession,
} from '@textscene/core/linter';
import { isGodotTextResourcePath } from '@textscene/core/godot';
import { error as logError } from '@textscene/core/logger';
import { comparablePath, isWithinRoot } from '@textscene/core/resources/resPath';
import { HOST_PATH_CASE } from './hostPathCase';
import { LintResourceProvider } from './LintResourceProvider';
import { findEnclosingGodotProject, hasProjectFile } from './findGodotProjectRoot';
import {
  ANY_PATH_PATTERN,
  EXTENSION_LIST_PATTERN,
  GDEXTENSION_PATTERN,
  SCAN_STOP_FILES_PATTERN,
} from './watchPatterns';

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

/**
 * A core diagnostic as a `vscode.Diagnostic`, its squiggle placed by core's `diagnosticRange`.
 * One about the whole file gets a collapsed marker at Ln 1, Col 1 of the Problems panel.
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

function rangeForDiagnostic(diagnostic: TscnLintDiagnostic, document: DocumentLineSource): vscode.Range {
  const { start, end } = diagnosticRange(diagnostic, {
    lineCount: document.lineCount,
    lineLength: (line) => document.lineAt(line).text.length,
  });
  return new vscode.Range(
    new vscode.Position(start.line, start.character),
    new vscode.Position(end.line, end.character)
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
  /** Each linted open document, by URI. Written by `_recordOf`, deleted on close, cleared by `_clearAll`. */
  private readonly _documents = new Map<string, DocumentLint>();
  /**
   * One provider per project root, so the documents of a project share its verdicts. Written by `providerFor`,
   * deleted when its root is deleted, cleared by `_clearAll`.
   */
  private readonly _providers = new Map<string, LintResourceProvider>();
  /**
   * Whether each directory holds `project.godot`, so the walks of a project's documents share their answers.
   * Written by `_holdsProjectFile`, cleared on any `project.godot` event, on a delete that holds a project root, and by
   * `_clearAll`.
   */
  private readonly _projectFileByDir = new Map<string, Promise<boolean>>();
  private _enabled: boolean;
  private _debounceMs: number;

  /**
   * @param resourceFiles - The events of the extension's resource-file watcher, which the glTF files a lint reads
   *   are among
   * @param projectFile - The events of the extension's `project.godot` watcher, which the previews share
   */
  constructor(
    resourceFiles: FileEvents,
    projectFile: FileEvents,
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
    const gdextensions = vscode.workspace.createFileSystemWatcher(GDEXTENSION_PATTERN);
    const scanStopFiles = vscode.workspace.createFileSystemWatcher(SCAN_STOP_FILES_PATTERN);
    const deletedPaths = vscode.workspace.createFileSystemWatcher(ANY_PATH_PATTERN, true, true, false);
    this._disposables.push(extensionList, gdextensions, scanStopFiles, deletedPaths);
    this._disposables.push(deletedPaths.onDidDelete((uri) => this._onPathDeleted(uri)));
    this._subscribe(extensionList, (uri) => this._onDependencyChanged(uri));
    this._subscribe(projectFile, (uri) => this._onProjectFileChanged(uri));
    // Only these files' presence counts toward the listing, so a change to their content re-lints nothing.
    const onListingChanged = (uri: vscode.Uri) => this._onListingChanged(uri);
    for (const watcher of [gdextensions, scanStopFiles]) {
      this._disposables.push(watcher.onDidCreate(onListingChanged), watcher.onDidDelete(onListingChanged));
    }
    this._disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this._onWorkspaceFoldersChanged())
    );

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
    const linted = document.version;
    const { now, later } = record.session.lint(document.getText(), record.provider ?? null);
    this._publish(document, record, now);
    later
      ?.then((complete) => {
        // An edit since this lint moved the lines `complete` names, and the edit's own lint publishes again.
        if (
          complete &&
          document.version === linted &&
          this._documents.get(document.uri.toString()) === record
        ) {
          this._publish(document, record, complete);
        }
      })
      .catch((reason: unknown) => logError('[TscnDiagnostics] Cross-file lint failed:', reason));
    if (record.provider === undefined && record.walk === undefined) this._walk(document, record);
  }

  private _subscribe(events: FileEvents, handler: (uri: vscode.Uri) => void): void {
    this._disposables.push(
      events.onDidCreate(handler),
      events.onDidChange(handler),
      events.onDidDelete(handler)
    );
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
   * Schedules a lint of each open document in the project that holds `uri` whose last lint read anything: its plugin
   * probe lists the project's GDExtension files, so a GDExtension, a `.gdignore` or a nested `project.godot` added or
   * removed can change its answer.
   */
  private _onListingChanged(uri: vscode.Uri): void {
    if (!this._enabled) return;
    for (const document of vscode.workspace.textDocuments) {
      const record = this._documents.get(document.uri.toString());
      if (record?.provider?.holds(uri) && record.session.reads.length > 0) this._scheduleLint(document);
    }
  }

  /**
   * Reacts to a deleted file or folder. A provider rooted at or under `uri` goes, and each open document it served
   * walks again. Each other open document whose last lint read a path under `uri`, or whose project's last listing
   * found one, is scheduled for a lint. The other watchers cover a single file, and this covers a whole folder.
   */
  private _onPathDeleted(uri: vscode.Uri): void {
    // Before the enabled check: a walk running when diagnostics went off can still fill the maps.
    const gone = this._dropProvidersWithin(uri);
    if (!this._enabled) return;
    for (const document of vscode.workspace.textDocuments) {
      const record = this._documents.get(document.uri.toString());
      const provider = record?.provider;
      if (!provider) continue;
      if (gone.has(provider)) this._walk(document, record);
      else if (this._readsUnder(record, provider, uri)) this._scheduleLint(document);
    }
  }

  /** Forgets each provider rooted at or under `dir`, and every directory answer if one went. Returns those it forgot. */
  private _dropProvidersWithin(dir: vscode.Uri): Set<LintResourceProvider> {
    const gone = new Set<LintResourceProvider>();
    for (const [key, provider] of this._providers) {
      if (!provider.isRootedWithin(dir)) continue;
      this._providers.delete(key);
      gone.add(provider);
    }
    if (gone.size > 0) this._projectFileByDir.clear();
    return gone;
  }

  /**
   * Whether the last lint of `record` read a file under `dir`, or listed one: its probe may have listed the project
   * only when it read anything, and the provider keeps the last listing.
   */
  private _readsUnder(record: DocumentLint, provider: LintResourceProvider, dir: vscode.Uri): boolean {
    const { reads } = record.session;
    const under = (path: string) => {
      const file = provider.fileOf(path);
      return file !== null && isWithinRoot(dir.fsPath, file.fsPath, HOST_PATH_CASE);
    };
    return reads.some(under) || (reads.length > 0 && provider.listed.some(under));
  }

  /**
   * Walks again for each open document under `uri`'s directory, the documents whose project the file roots or
   * would root, and lints each once its walk answers. A provider whose root is unchanged stays, verdicts included.
   */
  private _onProjectFileChanged(uri: vscode.Uri): void {
    // Before the enabled check: a walk running when diagnostics went off can still fill the map.
    this._projectFileByDir.clear();
    if (!this._enabled) return;
    const projectDir = vscode.Uri.joinPath(uri, '..').fsPath;
    for (const document of vscode.workspace.textDocuments) {
      if (!isTscnDocument(document) || !isWithinRoot(projectDir, document.uri.fsPath, HOST_PATH_CASE))
        continue;
      const record = this._documents.get(document.uri.toString());
      if (record) this._walk(document, record);
    }
  }

  /** Walks again for each open document, since a workspace folder added or removed can move it into or out of a project. */
  private _onWorkspaceFoldersChanged(): void {
    if (!this._enabled) return;
    for (const document of vscode.workspace.textDocuments) {
      const record = this._documents.get(document.uri.toString());
      if (record) this._walk(document, record);
    }
  }

  /** Finds `document`'s project, then lints it with that project's provider, unless the record is gone or walked again. */
  private _walk(document: vscode.TextDocument, record: DocumentLint): void {
    const walk = Symbol('walk');
    record.walk = walk;
    this.providerFor(document.uri)
      .then((provider) => {
        if (record.walk !== walk || this._documents.get(document.uri.toString()) !== record) return;
        record.walk = undefined;
        record.provider = provider;
        this.lintDocument(document);
      })
      .catch((reason: unknown) => logError('[TscnDiagnostics] Project lookup failed:', reason));
  }

  /**
   * The provider of the Godot project `uri` belongs to, shared with every document of that project,
   * or null outside one. The agent lint tool reads it too, so it gives the Problems panel's verdict.
   */
  async providerFor(uri: vscode.Uri): Promise<LintResourceProvider | null> {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return null;
    const root = await findEnclosingGodotProject(folder.uri, uri, (dir) => this._holdsProjectFile(dir));
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
