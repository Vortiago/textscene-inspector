/**
 * The scene tree as hierarchical LSP document symbols. The heading's `parent=` names the node's
 * ancestor by its path relative to the scene root, so a node attaches to the section already seen
 * under that path. A node's range reaches through its descendants, so folding the outline hides
 * the whole subtree.
 */

import { SymbolKind, type DocumentSymbol, type Range } from 'vscode-languageserver/node';
import type { LanguageDocument } from '@textscene/core/languageFeatures';

interface PendingSymbol {
  readonly name: string;
  readonly detail: string;
  /** One-based, as the parser counts. */
  readonly headingLine: number;
  /** One-based heading of the next section, before descendants extend it. */
  readonly endLine: number;
  readonly children: PendingSymbol[];
}

/**
 * Build the tree: the root is stored under `"."`, the value its direct children give in `parent=`;
 * a deeper node is stored under its own path. A node whose parent is missing (a malformed file)
 * becomes a second root, so no symbol is lost.
 */
function buildTree(document: LanguageDocument): PendingSymbol[] {
  const roots: PendingSymbol[] = [];
  const byPath = new Map<string, PendingSymbol>();
  for (const section of document.sections) {
    if (section.kind !== 'node') continue;
    const name = section.attributes.name;
    if (name === undefined) continue;
    const symbol: PendingSymbol = {
      name,
      detail: section.attributes.type ?? '',
      headingLine: section.headingLine,
      endLine: section.endLine,
      children: [],
    };
    const parent = section.attributes.parent;
    if (parent === undefined) {
      byPath.set('.', symbol);
      roots.push(symbol);
      continue;
    }
    const parentSymbol = byPath.get(parent);
    byPath.set(parent === '.' ? name : `${parent}/${name}`, symbol);
    if (parentSymbol) parentSymbol.children.push(symbol);
    else roots.push(symbol);
  }
  return roots;
}

/** The last one-based line of a symbol's own body or of any descendant's. */
function subtreeEnd(symbol: PendingSymbol): number {
  let end = symbol.endLine;
  for (const child of symbol.children) end = Math.max(end, subtreeEnd(child));
  return end;
}

function lineLength(document: LanguageDocument, lineIndex: number): number {
  return document.lines[lineIndex]?.length ?? 0;
}

function toLspSymbol(document: LanguageDocument, symbol: PendingSymbol): DocumentSymbol {
  const headingIndex = symbol.headingLine - 1;
  const endIndex = subtreeEnd(symbol) - 1;
  const range: Range = {
    start: { line: headingIndex, character: 0 },
    end: { line: endIndex, character: lineLength(document, endIndex) },
  };
  const selectionRange: Range = {
    start: { line: headingIndex, character: 0 },
    end: { line: headingIndex, character: lineLength(document, headingIndex) },
  };
  return {
    name: symbol.name,
    detail: symbol.detail,
    kind: SymbolKind.Object,
    range,
    selectionRange,
    children: symbol.children.map((child) => toLspSymbol(document, child)),
  };
}

/** Every node of the document as a hierarchical symbol, the scene root first. */
export function documentSymbols(document: LanguageDocument): DocumentSymbol[] {
  return buildTree(document).map((symbol) => toLspSymbol(document, symbol));
}
