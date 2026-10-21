/**
 * The scene tree as hierarchical document symbols, each node under the node Godot seats it under.
 * A node's range reaches through its descendants, so a child's range sits inside its parent's, as
 * an outline, breadcrumbs and sticky scroll expect.
 */

import type { LanguageDocument } from './document.js';
import { seatedNodeTree, type SeatedSection } from './nodeSeating.js';
import { linesRange } from './ranges.js';
import type { DocumentSymbol, SymbolKind } from './types.js';

/** The icon a few common node types show. Every other node is an `object`. */
const SYMBOL_KIND_BY_TYPE: Readonly<Record<string, SymbolKind>> = {
  MeshInstance3D: 'class',
  Camera3D: 'struct',
  Node3D: 'module',
};

function symbolKindOf(type: string): SymbolKind {
  return Object.hasOwn(SYMBOL_KIND_BY_TYPE, type) ? SYMBOL_KIND_BY_TYPE[type]! : 'object';
}

/** The last one-based line of a node's own body or of any descendant's. */
function subtreeEnd({ section, children }: SeatedSection): number {
  let end = section.endLine;
  for (const child of children) end = Math.max(end, subtreeEnd(child));
  return end;
}

/**
 * The symbols of the named nodes. VS Code refuses a symbol with an empty name, and a heading being
 * typed has one, so the children of a nameless node take its place and the outline keeps them.
 */
function namedSymbols(document: LanguageDocument, nodes: readonly SeatedSection[]): DocumentSymbol[] {
  return nodes.flatMap((node) =>
    node.section.attributes.name ? [toSymbol(document, node)] : namedSymbols(document, node.children)
  );
}

function toSymbol(document: LanguageDocument, node: SeatedSection): DocumentSymbol {
  const { attributes, headingLine } = node.section;
  const type = attributes.type ?? '';
  const line = headingLine - 1;
  return {
    name: attributes.name!,
    detail: type,
    kind: symbolKindOf(type),
    range: linesRange(document, line, subtreeEnd(node) - 1),
    selectionRange: linesRange(document, line, line),
    children: namedSymbols(document, node.children),
  };
}

/** Every node of the document as a hierarchical symbol, the scene root first. */
export function documentSymbols(document: LanguageDocument): readonly DocumentSymbol[] {
  return namedSymbols(document, seatedNodeTree(document));
}
