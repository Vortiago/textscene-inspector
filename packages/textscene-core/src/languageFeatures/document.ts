/**
 * One parsed document, as the language features read it: the section each line belongs
 * to and the slot each property fills. Built by the one scanning loop the parser and
 * linter share, through a `ParseObserver`, so no second `.tscn` grammar exists here.
 *
 * Section and property lines are one-based, the parser's and `Diagnostic.location`'s
 * convention. Every range a feature returns is zero-based. See `types.ts`.
 */

import {
  TscnParserCore,
  type HeadingColumns,
  type ParseObserver,
  type SectionType,
} from '../parser/TscnParserCore.js';
import { splitLines, stripLineComment, type ParsedHeading } from '../parser/utils.js';

/** The four section tags a feature reads, and `other` for the rest (`gd_scene`, `connection`). */
type SectionKind = 'node' | 'sub_resource' | 'ext_resource' | 'resource' | 'other';

/** One property line, as written, with Godot's resolution beside it. */
export interface PropertySlot {
  readonly key: string;
  /** The key the engine stores it under, a deprecated spelling resolved. */
  readonly storedKey: string;
  readonly value: string;
  /** One-based line the key sits on. */
  readonly startLine: number;
  /** The 0-based column its key starts at, past a heading's `]` where it follows one. */
  readonly startColumn: number;
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
  /** The columns the heading spans on its first line, so a second heading on that line reads alone. */
  readonly headingColumns: HeadingColumns;
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
  readonly columns: HeadingColumns;
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

function scanHeadings(text: string): ScannedHeading[] {
  const headings: ScannedHeading[] = [];
  // The class a `.tres` header names, which its later `[resource]` body belongs to.
  let resourceHeaderType: string | undefined;

  const observer: ParseObserver = {
    onSectionStart(heading: ParsedHeading, section: SectionType, line: number, columns: HeadingColumns) {
      if (heading.type === 'gd_resource') resourceHeaderType = heading.attributes.type;
      headings.push({
        line,
        columns,
        tag: heading.type,
        kind: toKind(section),
        ownerType: ownerTypeOf(heading, resourceHeaderType),
        attributes: { ...heading.attributes },
        properties: [],
      });
    },
    onProperty(property) {
      headings.at(-1)?.properties.push({
        key: property.key,
        storedKey: property.stored.key,
        value: property.value,
        startLine: property.line,
        startColumn: property.column,
        endLine: property.endLine,
        isMultiline: property.isMultiline,
      });
    },
  };

  // A null node creator: the scan only needs the observer's headings and properties.
  new TscnParserCore().parse(text, () => null, observer);
  return headings;
}

function scanSections(text: string, lines: readonly string[]): DocumentSection[] {
  const headings = scanHeadings(text);
  return headings.map((heading, index) => {
    const next = headings[index + 1];
    // A heading that shares its line with the next one still holds that line.
    const lastLine = next ? Math.max(heading.line, next.line - 1) : lines.length;
    return {
      kind: heading.kind,
      tag: heading.tag,
      headingLine: heading.line,
      headingColumns: heading.columns,
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
  private readonly sectionByLine: Map<number, DocumentSection>;
  /** The sections whose heading starts on each line, in order: a line can hold several. */
  private readonly headingsByLine: Map<number, DocumentSection[]>;
  private readonly propertyByLine: Map<number, PropertyLocation>;

  constructor(readonly text: string) {
    this.lines = splitLines(text);
    this.sections = scanSections(text, this.lines);
    this.sectionByLine = new Map();
    this.headingsByLine = new Map();
    this.propertyByLine = new Map();
    for (const section of this.sections) {
      const sharing = this.headingsByLine.get(section.headingLine);
      if (sharing) sharing.push(section);
      else this.headingsByLine.set(section.headingLine, [section]);
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

  /** The section a one-based line and a zero-based column belong to, or undefined outside every heading. */
  sectionAt(line: number, character: number): DocumentSection | undefined {
    const section = this.sectionByLine.get(line);
    if (section?.headingLine !== line) return section;
    // The column picks the last heading on the line that starts at or before it, else the first one.
    const onLine = this.headingsByLine.get(line)!;
    const started = onLine.filter((found) => found.headingColumns.start <= character);
    return started.at(-1) ?? onLine[0];
  }

  /** A heading's first line, blank outside its own columns and without a comment: each offset is a column. */
  headingText(section: DocumentSection): string {
    const line = this.lines[section.headingLine - 1] ?? '';
    const { start, end } = section.headingColumns;
    return stripLineComment(' '.repeat(start) + line.slice(start, end)).trimEnd();
  }

  /** Whether a one-based line and a zero-based column fall in a heading, not in a property after its `]`. */
  isInHeading(line: number, character: number): boolean {
    const section = this.sectionAt(line, character);
    if (section?.headingLine !== line) return false;
    const location = this.propertyByLine.get(line);
    const property = location?.section === section ? location.property : undefined;
    return !(property && property.startLine === line && character >= property.startColumn);
  }

  /** The property a one-based line belongs to, with its section. */
  propertyAt(line: number): PropertyLocation | undefined {
    return this.propertyByLine.get(line);
  }
}
