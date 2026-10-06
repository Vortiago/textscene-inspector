/**
 * The scene tree as hierarchical document symbols. The heading's `parent=` names the node's
 * ancestor by its path relative to the scene root, so a node attaches to the section already seen
 * under that path. A node's range reaches through its descendants, so a child's range sits inside
 * its parent's, as an outline, breadcrumbs and sticky scroll expect.
 */

import type { LanguageDocument } from './document.js';
import { nodePathOf } from './nodePath.js';
import type { DocumentSymbol, Range, SymbolKind } from './types.js';

/** The icon a few common node types show. Every other node is an `object`. */
const SYMBOL_KIND_BY_TYPE: Readonly<Record<string, SymbolKind>> = {
  MeshInstance3D: 'class',
  Camera3D: 'struct',
  Node3D: 'module',
};

function symbolKindOf(type: string): SymbolKind {
  return Object.hasOwn(SYMBOL_KIND_BY_TYPE, type) ? SYMBOL_KIND_BY_TYPE[type]! : 'object';
}

interface PendingSymbol {
  readonly name: string;
  readonly type: string;
  /** One-based, as the parser counts. */
  readonly headingLine: number;
  /** One-based last line of the node's own body, before descendants extend it. */
  readonly endLine: number;
  readonly children: PendingSymbol[];
}

/**
 * The tree stores the root under `"."`, the value its direct children give in `parent=`, and a
 * deeper node under its own path. A node whose parent is missing, as in a malformed file, becomes a
 * second root, so no symbol is lost.
 */
function buildTree(document: LanguageDocument): PendingSymbol[] {
  const roots: PendingSymbol[] = [];
  const byPath = new Map<string, PendingSymbol>();
  for (const section of document.sections) {
    if (section.kind !== 'node') continue;
    const path = nodePathOf(section);
    // VS Code refuses a symbol with an empty name, and a heading being typed has one.
    if (path === undefined) continue;
    const symbol: PendingSymbol = {
      name: section.attributes.name!,
      type: section.attributes.type ?? '',
      headingLine: section.headingLine,
      endLine: section.endLine,
      children: [],
    };
    const parent = section.attributes.parent;
    const parentSymbol = parent === undefined ? undefined : byPath.get(parent);
    byPath.set(path, symbol);
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

/** Zero-based lines `fromLine` to `toLine`, each whole. */
function linesRange(document: LanguageDocument, fromLine: number, toLine: number): Range {
  return {
    start: { line: fromLine, character: 0 },
    end: { line: toLine, character: document.lines[toLine]?.length ?? 0 },
  };
}

function toSymbol(document: LanguageDocument, symbol: PendingSymbol): DocumentSymbol {
  const headingLine = symbol.headingLine - 1;
  return {
    name: symbol.name,
    detail: symbol.type,
    kind: symbolKindOf(symbol.type),
    range: linesRange(document, headingLine, subtreeEnd(symbol) - 1),
    selectionRange: linesRange(document, headingLine, headingLine),
    children: symbol.children.map((child) => toSymbol(document, child)),
  };
}

/** Every node of the document as a hierarchical symbol, the scene root first. */
export function documentSymbols(document: LanguageDocument): readonly DocumentSymbol[] {
  return buildTree(document).map((symbol) => toSymbol(document, symbol));
}
