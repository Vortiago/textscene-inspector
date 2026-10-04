/**
 * One parsed document, as the language features read it: the section each line belongs
 * to and the slot each property fills. Built by the one scanning loop the parser and
 * linter share, through a `ParseObserver`, so no second `.tscn` grammar exists here.
 *
 * Section and property lines are one-based, the parser's and `Diagnostic.location`'s
 * convention. Every range a feature returns is zero-based. See `types.ts`.
 */

import { TscnParserCore, type ParseObserver, type SectionType } from '../parser/TscnParserCore.js';
import type { ParsedHeading } from '../parser/utils.js';

/** The four section tags a feature reads, and `other` for the rest (`gd_scene`, `connection`). */
export type SectionKind = 'node' | 'sub_resource' | 'ext_resource' | 'resource' | 'other';

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

/** A property and the section that holds it. */
export interface PropertyLocation {
  readonly section: DocumentSection;
  readonly property: PropertySlot;
}

function toKind(section: SectionType): SectionKind {
  return section === 'none' ? 'other' : section;
}

interface RawHeading {
  readonly line: number;
  readonly tag: string;
  readonly kind: SectionKind;
  readonly ownerType?: string;
  readonly attributes: Record<string, string>;
}

/** Trailing blank lines belong to no heading, so a fold ends on the last content line. */
function trimTrailingBlanks(lines: readonly string[], from: number, to: number): number {
  let end = to;
  while (end > from && lines[end - 1]!.trim().length === 0) end--;
  return end;
}

function scanSections(lines: readonly string[]): DocumentSection[] {
  const headings: RawHeading[] = [];
  const slotsByHeading: PropertySlot[][] = [];
  let current = -1;
  // The class a `.tres` header names, which its later `[resource]` body belongs to.
  let resourceHeaderType: string | undefined;

  const observer: ParseObserver = {
    onSectionStart(heading: ParsedHeading, section: SectionType, line: number) {
      if (heading.type === 'gd_resource') resourceHeaderType = heading.attributes.type;
      headings.push({
        line,
        tag: heading.type,
        kind: toKind(section),
        // The observer's owner type: a heading's own `type=`, or the header's for a body.
        ownerType: heading.attributes.type ?? (heading.type === 'resource' ? resourceHeaderType : undefined),
        attributes: { ...heading.attributes },
      });
      slotsByHeading.push([]);
      current = headings.length - 1;
    },
    onProperty(property) {
      if (current < 0) return;
      const continuations = property.value.split('\n').length - 1;
      slotsByHeading[current]!.push({
        key: property.key,
        storedKey: property.stored.key,
        value: property.value,
        startLine: property.line,
        endLine: property.line + continuations,
        isMultiline: property.isMultiline,
      });
    },
  };

  // A null node creator: the scan only needs the observer's headings and properties.
  // `silent`, since a host scans on each keystroke.
  new TscnParserCore().parse(lines.join('\n'), () => null, observer, { silent: true });

  return headings.map((heading, index) => {
    const next = headings[index + 1];
    const rawEnd = next ? next.line - 1 : lines.length;
    return {
      kind: heading.kind,
      tag: heading.tag,
      headingLine: heading.line,
      endLine: trimTrailingBlanks(lines, heading.line, rawEnd),
      attributes: heading.attributes,
      ...(heading.ownerType !== undefined ? { ownerType: heading.ownerType } : {}),
      properties: slotsByHeading[index] ?? [],
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
  private readonly sectionByLine: Map<number, DocumentSection>;
  private readonly propertyByLine: Map<number, PropertyLocation>;

  constructor(readonly text: string) {
    this.lines = text.split(/\r?\n/);
    this.sections = scanSections(this.lines);
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
  }

  /** The section a one-based line belongs to, or undefined outside every heading. */
  sectionAt(line: number): DocumentSection | undefined {
    return this.sectionByLine.get(line);
  }

  /** The property a one-based line belongs to, with its section. */
  propertyAt(line: number): PropertyLocation | undefined {
    return this.propertyByLine.get(line);
  }
}
