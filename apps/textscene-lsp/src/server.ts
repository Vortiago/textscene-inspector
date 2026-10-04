/**
 * The tscn-lsp language server: LSP over stdio, with the core language features and linter
 * behind it. It serves any client (Neovim, Helix, Zed, Emacs, Sublime) the same hover,
 * completion, quick fixes, folding, symbols, navigation and diagnostics the VS Code extension
 * provides. It imports no React and no THREE, since both bundles are plain Node.
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
  codeActions,
  completionsAt,
  createLanguageDocument,
  documentHighlights,
  foldingRanges,
  hoverAt,
} from '@textscene/core/languageFeatures';
import {
  toLspCodeAction,
  toLspCompletion,
  toLspDiagnostic,
  toLspFoldingRange,
  toLspHighlight,
  toLspHover,
} from './lspConvert';
import { resourceIdLocation, resourceLinks, resPathAt } from './navigation';
import {
  fileExists,
  listResPaths,
  projectFileOf,
  projectRootForDir,
  projectRootForFile,
  providerForRoot,
} from './project';
import { documentSymbols } from './symbols';

/** Wait after the last edit before a lint, so a burst of keystrokes lints once. */
const LINT_DEBOUNCE_MS = 300;

const ZERO_RANGE: Range = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
};

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
const documents = new TextDocuments(TextDocument);
const linter = new Linter();

/** The client's root URI, the fallback project for a document with no file path. */
let workspaceRoot: string | null = null;

/** Each open document's project root, so a request does not walk the tree again. */
const rootByUri = new Map<string, Promise<string | null>>();
/** Each document's pending debounced lint. */
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
  const uri = params.rootUri ?? params.workspaceFolders?.[0]?.uri ?? null;
  return uri === null ? null : filePathOf(uri);
}

function rootForUri(uri: string): Promise<string | null> {
  let root = rootByUri.get(uri);
  if (root === undefined) {
    const path = filePathOf(uri);
    root =
      path !== null
        ? projectRootForFile(path)
        : workspaceRoot !== null
          ? projectRootForDir(workspaceRoot)
          : Promise.resolve(null);
    rootByUri.set(uri, root);
  }
  return root;
}

/** The model a request reads, or undefined for a document the client never opened. */
function modelOf(uri: string) {
  const document = documents.get(uri);
  return document === undefined ? undefined : { document, model: createLanguageDocument(document.getText()) };
}

function scheduleLint(document: TextDocument): void {
  const existing = lintTimers.get(document.uri);
  if (existing !== undefined) clearTimeout(existing);
  lintTimers.set(
    document.uri,
    setTimeout(() => {
      lintTimers.delete(document.uri);
      void lintDocument(document);
    }, LINT_DEBOUNCE_MS)
  );
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
        triggerCharacters: ['"', '=', '.', '/', '('],
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

connection.onInitialized(() => {
  // No dynamic registration: every capability is static.
});

connection.onShutdown(() => {
  // Nothing to release: the linter keeps no handles.
});

connection.onExit(() => {
  process.exit(0);
});

connection.onCompletion(async (params): Promise<CompletionItem[] | null> => {
  const found = modelOf(params.textDocument.uri);
  if (!found) return null;
  const root = await rootForUri(params.textDocument.uri);
  let listPaths: (() => readonly string[]) | undefined;
  if (root !== null) {
    const paths = await listResPaths(root);
    listPaths = () => paths;
  }
  return completionsAt(found.model, params.position, { listPaths }).map(toLspCompletion);
});

connection.onHover((params): Hover | null => {
  const found = modelOf(params.textDocument.uri);
  if (!found) return null;
  const hover = hoverAt(found.model, params.position);
  return hover === undefined ? null : toLspHover(hover);
});

connection.onCodeAction((params): CodeAction[] | null => {
  const found = modelOf(params.textDocument.uri);
  if (!found) return null;
  return codeActions(found.model, params.range).map((action) =>
    toLspCodeAction(action, params.textDocument.uri)
  );
});

connection.onFoldingRanges((params) => {
  const found = modelOf(params.textDocument.uri);
  return found === undefined ? null : foldingRanges(found.model).map(toLspFoldingRange);
});

connection.onDocumentSymbol((params): DocumentSymbol[] | null => {
  const found = modelOf(params.textDocument.uri);
  return found === undefined ? null : documentSymbols(found.model);
});

connection.onDefinition(async (params): Promise<Location | null> => {
  const found = modelOf(params.textDocument.uri);
  if (!found) return null;

  const idLocation = resourceIdLocation(found.model, params.position, params.textDocument.uri);
  if (idLocation !== undefined) return idLocation;

  const occurrence = resPathAt(found.model, params.position);
  if (occurrence === undefined) return null;
  const root = await rootForUri(params.textDocument.uri);
  if (root === null) return null;
  const file = projectFileOf(root, occurrence.path);
  if (file === null || !(await fileExists(file))) return null;
  return { uri: pathToFileURL(file).toString(), range: ZERO_RANGE };
});

connection.onDocumentHighlight((params) => {
  const found = modelOf(params.textDocument.uri);
  return found === undefined ? null : documentHighlights(found.model, params.position).map(toLspHighlight);
});

connection.onDocumentLinks(async (params): Promise<DocumentLink[]> => {
  const found = modelOf(params.textDocument.uri);
  if (!found) return [];
  const root = await rootForUri(params.textDocument.uri);
  return resourceLinks(found.model).map(({ path, range }) => {
    const file = root === null ? null : projectFileOf(root, path);
    return file === null ? { range } : { range, target: pathToFileURL(file).toString() };
  });
});

documents.onDidChangeContent((event) => {
  scheduleLint(event.document);
});

documents.onDidClose((event) => {
  const timer = lintTimers.get(event.document.uri);
  if (timer !== undefined) {
    clearTimeout(timer);
    lintTimers.delete(event.document.uri);
  }
  rootByUri.delete(event.document.uri);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.listen(connection);
connection.listen();
