/**
 * `ExtResource("…")` and `SubResource("…")` references, as an editor sees them: the
 * declaration each id names, every use of it, and the span a cursor can land on. The
 * ids are per file and per kind, so an `ext` id and a `sub` id may share a spelling.
 */

import type { LanguageDocument, DocumentSection } from './document.js';
import { headingAttribute, lineRange } from './ranges.js';
import type { Range } from './types.js';

export type ResourceRefKind = 'ext' | 'sub';

export interface ResourceReference {
  readonly kind: ResourceRefKind;
  readonly id: string;
}

/** A reference occurrence and where it sits. */
export interface ResourceReferenceSpan extends ResourceReference {
  readonly range: Range;
}

const REFERENCE_RE = /(Ext|Sub)Resource\(\s*"([^"]*)"\s*\)/g;

function kindOfTag(tag: string): ResourceRefKind | undefined {
  if (tag === 'ext_resource') return 'ext';
  if (tag === 'sub_resource') return 'sub';
  return undefined;
}

/** The id the declaration heading of an `ext_resource` or `sub_resource` names. */
function declaredId(section: DocumentSection): ResourceReference | undefined {
  const kind = kindOfTag(section.tag);
  if (!kind) return undefined;
  const id = section.attributes.id;
  return id === undefined ? undefined : { kind, id };
}

/** The reference a literal spells, for a whole single-line value. */
export function parseResourceReference(literal: string): ResourceReference | undefined {
  const match = /^\s*(Ext|Sub)Resource\(\s*"([^"]*)"\s*\)\s*$/.exec(literal);
  if (!match) return undefined;
  return { kind: match[1] === 'Ext' ? 'ext' : 'sub', id: match[2] ?? '' };
}

/** Every reference occurrence in the file, declaration headings' `instance=` included. */
export function resourceReferences(document: LanguageDocument): readonly ResourceReferenceSpan[] {
  const found: ResourceReferenceSpan[] = [];
  for (const [index, line] of document.lines.entries()) {
    REFERENCE_RE.lastIndex = 0;
    for (let match = REFERENCE_RE.exec(line); match !== null; match = REFERENCE_RE.exec(line)) {
      found.push({
        kind: match[1] === 'Ext' ? 'ext' : 'sub',
        id: match[2] ?? '',
        range: lineRange(index, { start: match.index, end: match.index + match[0].length }),
      });
    }
  }
  return found;
}

/** The ids declared by every `ext_resource` and `sub_resource` heading, keyed by kind and id. */
export function declaredResourceIds(document: LanguageDocument): ReadonlyMap<string, DocumentSection> {
  const declared = new Map<string, DocumentSection>();
  for (const section of document.sections) {
    const id = declaredId(section);
    if (id) declared.set(`${id.kind}:${id.id}`, section);
  }
  return declared;
}

/** The reference or declaration the cursor touches, or undefined. */
export function referenceAt(
  document: LanguageDocument,
  line: number,
  character: number
): ResourceReference | undefined {
  const section = document.sectionAt(line + 1);
  if (section && section.headingLine === line + 1) {
    const id = declaredId(section);
    if (id) {
      const attribute = headingAttribute(document.lines[line] ?? '', 'id');
      if (attribute && character >= attribute.span.start && character <= attribute.span.end) return id;
    }
  }
  for (const span of resourceReferences(document)) {
    if (
      span.range.start.line === line &&
      character >= span.range.start.character &&
      character <= span.range.end.character
    ) {
      return { kind: span.kind, id: span.id };
    }
  }
  return undefined;
}
