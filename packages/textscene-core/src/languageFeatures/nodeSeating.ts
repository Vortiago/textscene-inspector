/**
 * The `[node]` headings of a document, seated as the parsers seat them (`seatScene`), and the one
 * walk that resolves a root-relative node path over them. Built on the first request, since most
 * editor requests never read it.
 */

import { createRawNode, nodeOrigin } from '../parser/rawNode.js';
import { seatScene, type SceneSeating } from '../parser/sceneTreeBuilder.js';
import type { RawNode } from '../parser/types.js';
import type { ParsedHeading } from '../parser/utils.js';
import type { DocumentSection, LanguageDocument } from './document.js';

/** A `[node]` heading with the headings Godot seats under it. */
export interface SeatedSection {
  readonly section: DocumentSection;
  readonly children: readonly SeatedSection[];
}

interface DocumentSeating {
  readonly seating: SceneSeating<RawNode>;
  /** Each seated tree node, and each unseated heading's node, to its heading. */
  readonly sectionByNode: ReadonlyMap<RawNode, DocumentSection>;
  /** The scene root, then each heading left out of the tree, in line order. */
  readonly tree: readonly SeatedSection[];
}

/** Written only by {@link seatingOf}. An entry lives as long as its document. */
const seatings = new WeakMap<LanguageDocument, DocumentSeating>();

/** A `[node]` section's properties, keyed as the parser's bag keys them. */
function rawPropertiesOf(section: DocumentSection): Record<string, string> {
  return Object.fromEntries(section.properties.map(({ storedKey, value }) => [storedKey, value]));
}

function headingOf(section: DocumentSection): ParsedHeading {
  return { type: section.tag, attributes: { ...section.attributes } };
}

function seat(document: LanguageDocument): DocumentSeating {
  const headings = document.sections
    .filter(({ kind }) => kind === 'node')
    .map((section) => {
      const heading = headingOf(section);
      const node = createRawNode(heading, rawPropertiesOf(section));
      return { section, ...nodeOrigin(heading, node, section.headingLine) };
    });
  const seating = seatScene(headings);
  const sectionByNode = new Map<RawNode, DocumentSection>();
  for (const { node, section } of headings) sectionByNode.set(seating.seated.get(node) ?? node, section);
  const seated = (node: RawNode): SeatedSection => ({
    section: sectionByNode.get(node)!,
    children: node.children.map(seated),
  });
  const unseated = headings.filter(({ node }) => !seating.seated.has(node)).map(({ node }) => node);
  return { seating, sectionByNode, tree: [...seating.roots, ...unseated].map(seated) };
}

function seatingOf(document: LanguageDocument): DocumentSeating {
  let seating = seatings.get(document);
  if (!seating) {
    seating = seat(document);
    seatings.set(document, seating);
  }
  return seating;
}

/** The `[node]` headings as Godot seats them: the scene root, then each heading left out of the tree, in line order. */
export function seatedNodeTree(document: LanguageDocument): readonly SeatedSection[] {
  return seatingOf(document).tree;
}

/** Written only by {@link seatedNodePaths}. An entry lives as long as its document. */
const seatedPaths = new WeakMap<LanguageDocument, ReadonlyMap<DocumentSection, string>>();

/** The root-relative path of each seated `[node]` heading with a name, the root at the empty path. */
export function seatedNodePaths(document: LanguageDocument): ReadonlyMap<DocumentSection, string> {
  let paths = seatedPaths.get(document);
  if (!paths) {
    const { seating, sectionByNode } = seatingOf(document);
    paths = new Map([...seating.pathOf].map(([node, path]) => [sectionByNode.get(node)!, path]));
    seatedPaths.set(document, paths);
  }
  return paths;
}

/** The `[node]` heading a root-relative node path names, or undefined where no heading is seated there. */
export function nodeSectionOfPath(document: LanguageDocument, path: string): DocumentSection | undefined {
  const { seating, sectionByNode } = seatingOf(document);
  const resolution = seating.resolve(path);
  return resolution.status === 'found' ? sectionByNode.get(resolution.node) : undefined;
}
