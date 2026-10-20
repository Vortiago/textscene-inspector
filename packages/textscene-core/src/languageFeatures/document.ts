/**
 * One parsed document, as the language features read it: the section each line belongs
 * to, the slot each property fills and where each `[node]` heading is seated. Built by the
 * one scanning loop and the one seating the parser and linter share, so no second `.tscn`
 * grammar or path table exists here.
 *
 * Section and property lines are one-based, the parser's and `Diagnostic.location`'s
 * convention. Every range a feature returns is zero-based. See `types.ts`.
 */

import { TscnParserCore, type ParseObserver, type SectionType } from '../parser/TscnParserCore.js';
import { createRawNode } from '../parser/rawNode.js';
import { strandedNodes } from '../parser/sceneTreeBuilder.js';
import type { NodeOrigin, NodePathResolution, RawNode } from '../parser/types.js';
import type { ParsedHeading } from '../parser/utils.js';

/** The four section tags a feature reads, and `other` for the rest (`gd_scene`, `connection`). */
type SectionKind = 'node' | 'sub_resource' | 'ext_resource' | 'resource' | 'other';

/** One property line, as written, with Godot's resolution beside it. */
export interface PropertySlot {
  readonly key: string;
  /** The key the engine stores it under, a deprecated spelling resolved. */
  readonly storedKey: string;
  readonly value: string;
  /** One-based line the value starts on. */
  readonly startLine: number;
  /** One-based line the value ends on, the same line unless the value is multiline. */
  readonly endLine: number;
  readonly isMultiline: boolean;
}

/** One heading and its body. */
export interface DocumentSection {
  readonly kind: SectionKind;
  /** The heading's tag, for example `node`. */
  readonly tag: string;
  readonly headingLine: number;
  readonly endLine: number;
  readonly attributes: Readonly<Record<string, string>>;
  /**
   * The class the body's properties belong to. A node's or sub-resource's `type=`, and
   * for a `.tres` `[resource]` body the class its `[gd_resource]` header names.
   */
  readonly ownerType?: string;
  readonly properties: readonly PropertySlot[];
}

/** A `[node]` heading with the headings Godot seats under it. */
export interface SeatedSection {
  readonly section: DocumentSection;
  readonly children: readonly SeatedSection[];
}

/** A property and the section that holds it. */
export interface PropertyLocation {
  readonly section: DocumentSection;
  readonly property: PropertySlot;
}

function toKind(section: SectionType): SectionKind {
  return section === 'none' ? 'other' : section;
}

/**
 * The class a heading's body properties belong to. An `ext_resource` or a file header holds no
 * properties, so its `type=` owns none.
 */
function ownerTypeOf(heading: ParsedHeading, resourceHeaderType: string | undefined): string | undefined {
  if (heading.type === 'node' || heading.type === 'sub_resource') return heading.attributes.type;
  if (heading.type === 'resource') return heading.attributes.type ?? resourceHeaderType;
  return undefined;
}

/** A heading as the scan meets it, before the next heading fixes where its body ends. */
interface ScannedHeading {
  readonly line: number;
  readonly tag: string;
  readonly kind: SectionKind;
  readonly ownerType?: string;
  readonly attributes: Record<string, string>;
  readonly properties: PropertySlot[];
}

/**
 * The last line of a body that holds content. Trailing blank lines belong to no heading,
 * so a fold ends on the last content line.
 */
function lastContentLine(lines: readonly string[], headingLine: number, lastLine: number): number {
  let end = lastLine;
  while (end > headingLine && lines[end - 1]!.trim().length === 0) end--;
  return end;
}

/** The headings of one scan, and the `[node]` headings seated as the parser seats them. */
interface Scan {
  readonly headings: readonly ScannedHeading[];
  readonly roots: readonly RawNode[];
  readonly origins: readonly NodeOrigin<RawNode>[];
  readonly resolveRootPath: (path: string) => NodePathResolution;
}

function scan(text: string): Scan {
  const headings: ScannedHeading[] = [];
  // The class a `.tres` header names, which its later `[resource]` body belongs to.
  let resourceHeaderType: string | undefined;

  const observer: ParseObserver = {
    onSectionStart(heading: ParsedHeading, section: SectionType, line: number) {
      if (heading.type === 'gd_resource') resourceHeaderType = heading.attributes.type;
      headings.push({
        line,
        tag: heading.type,
        kind: toKind(section),
        ownerType: ownerTypeOf(heading, resourceHeaderType),
        attributes: { ...heading.attributes },
        properties: [],
      });
    },
    onProperty(property) {
      const continuations = property.value.split('\n').length - 1;
      headings.at(-1)?.properties.push({
        key: property.key,
        storedKey: property.stored.key,
        value: property.value,
        startLine: property.line,
        endLine: property.line + continuations,
        isMultiline: property.isMultiline,
      });
    },
  };

  const { scene, origins, resolveRootPath } = new TscnParserCore().parse(text, createRawNode, observer);
  return { headings, roots: scene.nodes, origins, resolveRootPath };
}

function toSections(headings: readonly ScannedHeading[], lines: readonly string[]): DocumentSection[] {
  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const lastLine = next ? next.line - 1 : lines.length;
    return {
      kind: heading.kind,
      tag: heading.tag,
      headingLine: heading.line,
      endLine: lastContentLine(lines, heading.line, lastLine),
      attributes: heading.attributes,
      ...(heading.ownerType !== undefined ? { ownerType: heading.ownerType } : {}),
      properties: heading.properties,
    };
  });
}

/**
 * A parsed `.tscn` the language features query by line. The scan runs once at
 * construction. The lookups are maps, so a hover or completion costs no second parse.
 */
export class LanguageDocument {
  readonly lines: readonly string[];
  readonly sections: readonly DocumentSection[];
  /** The `[node]` headings as Godot seats them: the scene root, then each stranded heading in line order. */
  readonly nodeTree: readonly SeatedSection[];
  private readonly sectionByLine: Map<number, DocumentSection>;
  private readonly propertyByLine: Map<number, PropertyLocation>;
  private readonly sectionByNode: Map<RawNode, DocumentSection>;
  private readonly resolveRootPath: (path: string) => NodePathResolution;

  constructor(readonly text: string) {
    this.lines = text.split(/\r?\n/);
    const { headings, roots, origins, resolveRootPath } = scan(text);
    this.sections = toSections(headings, this.lines);
    this.sectionByLine = new Map();
    this.propertyByLine = new Map();
    for (const section of this.sections) {
      for (let line = section.headingLine; line <= section.endLine; line++) {
        this.sectionByLine.set(line, section);
      }
      for (const property of section.properties) {
        for (let line = property.startLine; line <= property.endLine; line++) {
          this.propertyByLine.set(line, { section, property });
        }
      }
    }
    this.sectionByNode = new Map(origins.map(({ node, line }) => [node, this.sectionByLine.get(line)!]));
    this.resolveRootPath = resolveRootPath;
    const stranded = strandedNodes(origins, roots).map(({ node }) => node);
    this.nodeTree = [...roots, ...stranded].map((node) => this.seated(node));
  }

  /** The section a one-based line belongs to, or undefined outside every heading. */
  sectionAt(line: number): DocumentSection | undefined {
    return this.sectionByLine.get(line);
  }

  /** The property a one-based line belongs to, with its section. */
  propertyAt(line: number): PropertyLocation | undefined {
    return this.propertyByLine.get(line);
  }

  /** The `[node]` heading a root-relative node path names, or undefined where no heading is seated there. */
  nodeSectionOfPath(path: string): DocumentSection | undefined {
    const resolution = this.resolveRootPath(path);
    return resolution.status === 'found' ? this.sectionByNode.get(resolution.node) : undefined;
  }

  private seated(node: RawNode): SeatedSection {
    return {
      section: this.sectionByNode.get(node)!,
      children: node.children.map((child) => this.seated(child)),
    };
  }
}
