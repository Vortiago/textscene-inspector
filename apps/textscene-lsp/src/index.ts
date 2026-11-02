/**
 * The public entry of `@textscene/lsp`: core's language features as LSP protocol shapes, so an LSP
 * host reuses the translation instead of speaking to the server. The server starts only through
 * the `tscn-lsp` bin: importing this entry starts no server, so a bundler can guess this
 * package's entry point.
 */

export {
  toLspCodeAction,
  toLspCompletion,
  toLspDiagnostic,
  toLspFoldingRange,
  toLspHighlight,
  toLspHover,
  toLspSymbol,
} from './lspConvert';

export type {
  CodeAction,
  CompletionItem,
  CompletionKind,
  DocumentHighlight,
  DocumentSymbol,
  FoldingRange,
  Hover,
  SymbolKind,
  TextEdit,
} from '@textscene/core/languageFeatures';
export type { Diagnostic, Severity } from '@textscene/core/linter';
