/**
 * The tscn-lsp language server: LSP over stdio, with the core language features and linter
 * behind it. It serves any client (Neovim, Helix, Zed, Emacs, Sublime) the same hover,
 * completion, quick fixes, folding, symbols, navigation and diagnostics the VS Code extension
 * host process provides. It imports no React and no THREE: the bundle runs in plain Node.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createConnection,
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
  declarationRangeAt,
  documentHighlights,
  documentSymbols,
  foldingRanges,
  hoverAt,
  resPathAt,
  resPathOccurrences,
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
import {
  isFile,
  listProjectPaths,
  projectRootForDir,
  projectRootForFile,
  providerForRoot,
} from '@textscene/core/resources/diskProject';
import { resolveResPath } from '@textscene/core/resources/resPath';

/** Wait after the last edit before a lint, so a burst of keystrokes lints once. */
const LINT_DEBOUNCE_MS = 300;

/** Where a definition in another file lands: its first character. */
const FILE_START: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
const documents = new TextDocuments(TextDocument);
const linter = new Linter();

/** The client's root URI, the fallback project for a document with no file path. */
let workspaceRoot: string | null = null;

/**
 * Each open document's project root, so a request does not walk the tree again. Written by
 * `rootForUri` and cleared on close.
 */
const rootByUri = new Map<string, Promise<string | null>>();
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

function rootForUri(uri: string): Promise<string | null> {
  const cached = rootByUri.get(uri);
  if (cached !== undefined) return cached;
  const root = findProjectRoot(uri);
  rootByUri.set(uri, root);
  return root;
}

/** The project of the document's file, or of the workspace for a document with no file path. */
function findProjectRoot(uri: string): Promise<string | null> {
  const path = filePathOf(uri);
  if (path !== null) return projectRootForFile(path);
  if (workspaceRoot !== null) return projectRootForDir(workspaceRoot);
  return Promise.resolve(null);
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
async function resPathFileUrl(root: string | null, path: string): Promise<string | undefined> {
  const file = root === null ? null : resolveResPath(root, path);
  return file !== null && (await isFile(file)) ? pathToFileURL(file).toString() : undefined;
}

function scheduleLint(document: TextDocument): void {
  cancelLint(document.uri);
  lintTimers.set(
    document.uri,
    setTimeout(() => {
      lintTimers.delete(document.uri);
      void lintDocument(document);
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
  const diagnostics = await linter.lintComplete(
    document.getText(),
    root === null ? null : providerForRoot(root)
  );
  const current = documents.get(document.uri);
  if (current === undefined || current.version !== version) return;
  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: diagnostics.map((diagnostic) => toLspDiagnostic(diagnostic, current)),
  });
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  workspaceRoot = workspaceRootOf(params);
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
      documentHighlightProvider: true,
      documentLinkProvider: { resolveProvider: false },
    },
  };
});

connection.onExit(() => {
  process.exit(0);
});

connection.onCompletion(async (params): Promise<CompletionItem[] | null> => {
  const model = modelOf(params.textDocument.uri);
  if (model === undefined) return null;
  const listPaths = async (): Promise<readonly string[]> => {
    const root = await rootForUri(params.textDocument.uri);
    return root === null ? [] : listProjectPaths(root);
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

  const declaration = declarationRangeAt(model, params.position);
  if (declaration !== undefined) return { uri: params.textDocument.uri, range: declaration };

  const occurrence = resPathAt(model, params.position);
  if (occurrence === undefined) return null;
  const target = await resPathFileUrl(await rootForUri(params.textDocument.uri), occurrence.path);
  return target === undefined ? null : { uri: target, range: FILE_START };
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

documents.onDidChangeContent((event) => {
  scheduleLint(event.document);
});

documents.onDidClose((event) => {
  cancelLint(event.document.uri);
  rootByUri.delete(event.document.uri);
  modelByUri.delete(event.document.uri);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.listen(connection);
connection.listen();
