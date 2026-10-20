/**
 * The `[node]` headings of a document, seated as the parsers seat them (`seatScene`), and the one
 * walk that resolves a root-relative node path over them. Built on the first request, since most
 * editor requests never read it.
 */

import { createRawNode } from '../parser/rawNode.js';
import { seatScene, strandedNodes, type SceneSeating } from '../parser/sceneTreeBuilder.js';
import type { RawNode } from '../parser/types.js';
import type { DocumentSection, LanguageDocument } from './document.js';

/** A `[node]` heading with the headings Godot seats under it. */
export interface SeatedSection {
  readonly section: DocumentSection;
  readonly children: readonly SeatedSection[];
}

interface DocumentSeating {
  readonly seating: SceneSeating<RawNode>;
  readonly sectionByNode: ReadonlyMap<RawNode, DocumentSection>;
  /** The scene root, then each stranded heading in line order. */
  readonly tree: readonly SeatedSection[];
}

/** Written only by {@link seatingOf}. An entry lives as long as its document. */
const seatings = new WeakMap<LanguageDocument, DocumentSeating>();

/** The Raw view node of a `[node]` section, its properties keyed as the parser's bag keys them. */
function rawNodeOf(section: DocumentSection): RawNode {
  const rawProperties = Object.fromEntries(
    section.properties.map(({ storedKey, value }) => [storedKey, value])
  );
  return createRawNode({ type: section.tag, attributes: { ...section.attributes } }, rawProperties);
}

function seat(document: LanguageDocument): DocumentSeating {
  const headings = document.sections
    .filter(({ kind }) => kind === 'node')
    .map((section) => ({ section, node: rawNodeOf(section) }));
  const seating = seatScene(headings.map(({ node }) => node));
  const sectionByNode = new Map(headings.map(({ node, section }) => [node, section]));
  const seated = (node: RawNode): SeatedSection => ({
    section: sectionByNode.get(node)!,
    children: node.children.map(seated),
  });
  const stranded = strandedNodes(headings, seating.roots).map(({ node }) => node);
  return { seating, sectionByNode, tree: [...seating.roots, ...stranded].map(seated) };
}

function seatingOf(document: LanguageDocument): DocumentSeating {
  let seating = seatings.get(document);
  if (!seating) {
    seating = seat(document);
    seatings.set(document, seating);
  }
  return seating;
}

/** The `[node]` headings as Godot seats them: the scene root, then each stranded heading in line order. */
export function seatedNodeTree(document: LanguageDocument): readonly SeatedSection[] {
  return seatingOf(document).tree;
}

/** The `[node]` heading a root-relative node path names, or undefined where no heading is seated there. */
export function nodeSectionOfPath(document: LanguageDocument, path: string): DocumentSection | undefined {
  const { seating, sectionByNode } = seatingOf(document);
  const resolution = seating.resolve(path);
  return resolution.status === 'found' ? sectionByNode.get(resolution.node) : undefined;
}
