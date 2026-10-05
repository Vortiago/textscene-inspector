/**
 * The language-feature engine: hover, completion, quick fixes, folding, highlights, the outline
 * and navigation for a `.tscn`, over the same parser and ClassDB captures the linter reads. It is
 * React- and THREE-free, so the `tscn-lsp` server and the VS Code extension host process both
 * import it. Every result is host-neutral, with zero-based ranges (`types.ts`). This entry point
 * exports only what a host calls.
 */

export type { LanguageDocument } from './document.js';
export { hoverAt } from './hover.js';
export { COMPLETION_TRIGGER_CHARACTERS, completionsAt, type CompletionContext } from './completion.js';
export { codeActions } from './codeActions.js';
export { foldingRanges } from './folding.js';
export { documentHighlights } from './highlights.js';
export { documentSymbols } from './symbols.js';
export { declarationRangeAt, resPathAt, resPathOccurrences, type ResPathOccurrence } from './navigation.js';
export type {
  CodeAction,
  CompletionItem,
  CompletionKind,
  DocumentHighlight,
  DocumentSymbol,
  FoldingRange,
  Hover,
  Position,
  Range,
  SymbolKind,
  TextEdit,
} from './types.js';

import { LanguageDocument } from './document.js';

/** Parses `text` once into the model every feature reads. */
export function createLanguageDocument(text: string): LanguageDocument {
  return new LanguageDocument(text);
}
