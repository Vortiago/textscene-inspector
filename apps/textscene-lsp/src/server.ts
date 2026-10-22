/**
 * The tscn-lsp language server: LSP over stdio, with the core language features and linter
 * behind it. It serves any client (Neovim, Helix, Zed, Emacs, Sublime) the same hover,
 * completion, quick fixes, folding, symbols, navigation and diagnostics the VS Code extension
 * host process provides. It imports no React and no THREE: the bundle runs in plain Node.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createConnection,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  type CodeAction,
  type CompletionItem,
  type DocumentLink,
  type DocumentSymbol,
  type Hover,
  type InitializeParams,
  type InitializeResult,
  type Location,
  type Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter } from '@textscene/core/linter';
import {
  COMPLETION_TRIGGER_CHARACTERS,
  codeActions,
  completionsAt,
  createLanguageDocument,
  definitionRangeAt,
  documentHighlights,
  documentSymbols,
  foldingRanges,
  hoverAt,
  resPathAt,
  resPathOccurrences,
  resPathReferencesAt,
  type LanguageDocument,
} from '@textscene/core/languageFeatures';
import {
  toLspCodeAction,
  toLspCompletion,
  toLspDiagnostic,
  toLspFoldingRange,
  toLspHighlight,
  toLspHover,
  toLspSymbol,
} from './lspConvert';
import { DISK_PATH_CASE, createDiskResRoots } from '@textscene/core/resources/diskProject';
import type { ResRoot, ResRoots } from '@textscene/core/resources/resRoots';
import { isSamePath } from '@textscene/core/resources/resPath';

/** Wait after the last edit before a lint, so a burst of keystrokes lints once. */
const LINT_DEBOUNCE_MS = 300;

/** Where a definition in another file lands: its first character. */
const FILE_START: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
const documents = new TextDocuments(TextDocument);
const linter = new Linter();

/**
 * The roots of the open documents' scenes, every answer read from the disk. Written by `onInitialize`, once the
 * client's root URI is known, and read by the requests that follow.
 */
let resRoots: ResRoots = createDiskResRoots(null);

/** Whether the client registers a file watcher at the server's request. Written once, by `onInitialize`. */
let canWatchFiles = false;

/**
 * Each open document's model at its latest version, written by `modelOf` and cleared on
 * close. A client sends several requests per edit, and they share one parse.
 */
const modelByUri = new Map<string, { readonly version: number; readonly model: LanguageDocument }>();
/** Written by `scheduleLint`, and cleared when the lint starts or the document closes. */
const lintTimers = new Map<string, ReturnType<typeof setTimeout>>();

function filePathOf(uri: string): string | null {
  try {
    return fileURLToPath(uri);
  } catch {
    // A non-file URI names no path on disk, so it belongs to no project.
    return null;
  }
}

function workspaceRootOf(params: InitializeParams): string | null {
  const uri =
    params.rootUri ??
    params.workspaceFolders?.[0]?.uri ??
    (params.rootPath ? pathToFileURL(params.rootPath).toString() : null);
  return uri === null ? null : filePathOf(uri);
}

/**
 * The `res://` root of the document's file: its project, or its own directory inside the workspace. A document
 * with no file path has no directory, so it takes the workspace's project, or none.
 */
function rootForUri(uri: string): Promise<ResRoot | null> {
  const path = filePathOf(uri);
  return path === null ? resRoots.workspaceRoot() : resRoots.rootOf(path);
}

/** The model a request reads, or undefined for a document the client never opened. */
function modelOf(uri: string): LanguageDocument | undefined {
  const document = documents.get(uri);
  if (document === undefined) return undefined;
  const cached = modelByUri.get(uri);
  if (cached !== undefined && cached.version === document.version) return cached.model;
  const model = createLanguageDocument(document.getText());
  modelByUri.set(uri, { version: document.version, model });
  return model;
}

/** The file URL a `res://` path names, or undefined for a path with no file in the project. */
async function resPathFileUrl(root: ResRoot | null, path: string): Promise<string | undefined> {
  const file = root === null ? null : await root.resolve(path);
  return file === null ? undefined : pathToFileURL(file).toString();
}

/** The text on disk of the file at `path` under `root`, or null for a file that is no text resource. */
async function readFileText(root: ResRoot, path: string): Promise<string | null> {
  const content = await root.loadResource(path);
  return typeof content === 'string' ? content : null;
}

/** The unsaved text of the open document at `file`, a host path, or undefined when the client has none open there. */
function openDocumentText(file: string): string | undefined {
  return documents
    .all()
    .find((document) => {
      const open = filePathOf(document.uri);
      return open !== null && isSamePath(open, file, DISK_PATH_CASE);
    })
    ?.getText();
}

function scheduleLint(document: TextDocument): void {
  cancelLint(document.uri);
  lintTimers.set(
    document.uri,
    setTimeout(() => {
      lintTimers.delete(document.uri);
      lintDocument(document).catch((error: unknown) => {
        // Node ends the process on an unhandled rejection, which would end every open document's features.
        connection.console.error(`[Lint] ${document.uri}: ${String(error)}`);
      });
    }, LINT_DEBOUNCE_MS)
  );
}

function cancelLint(uri: string): void {
  const timer = lintTimers.get(uri);
  if (timer === undefined) return;
  clearTimeout(timer);
  lintTimers.delete(uri);
}

/** Lint the document and push its diagnostics, unless a newer edit landed while the read ran. */
async function lintDocument(document: TextDocument): Promise<void> {
  const version = document.version;
  const root = await rootForUri(document.uri);
  const diagnostics = await linter.lintComplete(document.getText(), root);
  const current = documents.get(document.uri);
  if (current === undefined || current.version !== version) return;
  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: diagnostics.map((diagnostic) => toLspDiagnostic(diagnostic, current)),
  });
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  resRoots = createDiskResRoots(workspaceRootOf(params));
  canWatchFiles = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        triggerCharacters: [...COMPLETION_TRIGGER_CHARACTERS],
        resolveProvider: false,
      },
      hoverProvider: true,
      codeActionProvider: { codeActionKinds: ['quickfix'] },
      foldingRangeProvider: true,
      documentSymbolProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentHighlightProvider: true,
      documentLinkProvider: { resolveProvider: false },
    },
  };
});

connection.onInitialized(() => {
  if (!canWatchFiles) return;
  // Every file: a new texture changes path completion, and a new project.godot moves a root.
  connection.client
    .register(DidChangeWatchedFilesNotification.type, { watchers: [{ globPattern: '**/*' }] })
    .catch((error: unknown) => {
      // A client that refuses still refreshes the project each time a document opens.
      connection.console.warn(`[Watch] the client refused a file watcher: ${String(error)}`);
    });
});

connection.onDidChangeWatchedFiles(({ changes }) => {
  for (const { uri, type } of changes) {
    // A saved file keeps its place in every root and listing. Only a file that appears or goes changes one.
    if (type === FileChangeType.Changed) continue;
    const path = filePathOf(uri);
    if (path !== null) resRoots.invalidate(path);
  }
  for (const document of documents.all()) scheduleLint(document);
});

connection.onExit(() => {
  process.exit(0);
});

connection.onCompletion(async (params): Promise<CompletionItem[] | null> => {
  const model = modelOf(params.textDocument.uri);
  if (model === undefined) return null;
  const listPaths = async (): Promise<readonly string[]> => {
    const root = await rootForUri(params.textDocument.uri);
    return root === null ? [] : root.listPaths();
  };
  return (await completionsAt(model, params.position, { listPaths })).map(toLspCompletion);
});

connection.onHover((params): Hover | null => {
  const model = modelOf(params.textDocument.uri);
  if (model === undefined) return null;
  const hover = hoverAt(model, params.position);
  return hover === undefined ? null : toLspHover(hover);
});

connection.onCodeAction((params): CodeAction[] | null => {
  const model = modelOf(params.textDocument.uri);
  if (model === undefined) return null;
  return codeActions(model, params.range).map((action) => toLspCodeAction(action, params.textDocument.uri));
});

connection.onFoldingRanges((params) => {
  const model = modelOf(params.textDocument.uri);
  return model === undefined ? null : foldingRanges(model).map(toLspFoldingRange);
});

connection.onDocumentSymbol((params): DocumentSymbol[] | null => {
  const model = modelOf(params.textDocument.uri);
  return model === undefined ? null : documentSymbols(model).map(toLspSymbol);
});

connection.onDefinition(async (params): Promise<Location | null> => {
  const model = modelOf(params.textDocument.uri);
  if (model === undefined) return null;

  const declaration = definitionRangeAt(model, params.position);
  if (declaration !== undefined) return { uri: params.textDocument.uri, range: declaration };

  const occurrence = resPathAt(model, params.position);
  if (occurrence === undefined) return null;
  const target = await resPathFileUrl(await rootForUri(params.textDocument.uri), occurrence.path);
  return target === undefined ? null : { uri: target, range: FILE_START };
});

connection.onReferences(async (params, token): Promise<Location[] | null> => {
  const model = modelOf(params.textDocument.uri);
  if (model === undefined) return null;
  const root = await rootForUri(params.textDocument.uri);
  if (root === null) return [];
  const references = await resPathReferencesAt(model, params.position, {
    listPaths: () => root.listPaths(),
    openText: (path) => {
      const file = root.pathOf(path);
      return file === null ? undefined : openDocumentText(file);
    },
    readFile: (path) => readFileText(root, path),
    isCancelled: () => token.isCancellationRequested,
  });
  return references.flatMap(({ file, range }) => {
    const path = root.pathOf(file);
    return path === null ? [] : [{ uri: pathToFileURL(path).toString(), range }];
  });
});

connection.onDocumentHighlight((params) => {
  const model = modelOf(params.textDocument.uri);
  return model === undefined ? null : documentHighlights(model, params.position).map(toLspHighlight);
});

connection.onDocumentLinks(async (params): Promise<DocumentLink[]> => {
  const model = modelOf(params.textDocument.uri);
  if (model === undefined) return [];
  const root = await rootForUri(params.textDocument.uri);
  const links = resPathOccurrences(model);
  // One check per distinct path, all at once: a scene often names one file many times.
  const paths = [...new Set(links.map((link) => link.path))];
  const targetByPath = new Map(
    await Promise.all(paths.map(async (path) => [path, await resPathFileUrl(root, path)] as const))
  );
  return links.map(({ path, range }) => {
    const target = targetByPath.get(path);
    return target === undefined ? { range } : { range, target };
  });
});

// A watcher cannot see a project.godot created above the workspace, so opening a document reads the disk again. This
// also covers a client that watches no files.
documents.onDidOpen(() => {
  resRoots.invalidateAll();
});

documents.onDidChangeContent((event) => {
  scheduleLint(event.document);
});

documents.onDidClose((event) => {
  cancelLint(event.document.uri);
  modelByUri.delete(event.document.uri);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.listen(connection);
connection.listen();
