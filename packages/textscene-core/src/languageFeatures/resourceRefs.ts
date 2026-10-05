/**
 * `ExtResource("…")` and `SubResource("…")` references, as an editor sees them: the
 * declaration each id names, every use of it, and the span a cursor can land on. The
 * ids are per file and per kind, so an `ext` id and a `sub` id may share a spelling.
 * The grammar is `godot/resourceRef.ts`, the one the linter and the renderer read.
 */

import { openResourceRef, resourceRef, resourceRefSpans, type ResourceRef } from '../godot/resourceRef.js';
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

function toReference({ kind, id }: ResourceRef): ResourceReference {
  return { kind: kind === 'ExtResource' ? 'ext' : 'sub', id };
}

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

/** The reference a whole single-line value spells, padding aside. */
export function referenceInValue(literal: string): ResourceReference | undefined {
  const reference = resourceRef(literal.trim());
  return reference ? toReference(reference) : undefined;
}

/** The reference a line ends inside, with the id typed so far, for id completion. */
export function openReferenceAt(textBeforeCursor: string): ResourceReference | undefined {
  const reference = openResourceRef(textBeforeCursor);
  return reference ? toReference(reference) : undefined;
}

/** The reference occurrences on one zero-based line. */
function referencesOnLine(line: string, index: number): ResourceReferenceSpan[] {
  return resourceRefSpans(line).map((span) => ({
    ...toReference(span),
    range: lineRange(index, { start: span.start, end: span.end }),
  }));
}

/** Every reference occurrence in the file, declaration headings' `instance=` included. */
export function resourceReferences(document: LanguageDocument): readonly ResourceReferenceSpan[] {
  return [...document.lines.entries()].flatMap(([index, line]) => referencesOnLine(line, index));
}

/** A declared resource id and the heading that declares it. */
export interface ResourceDeclaration extends ResourceReference {
  readonly section: DocumentSection;
}

function declarationKey(reference: ResourceReference): string {
  return `${reference.kind}:${reference.id}`;
}

/**
 * Every id an `ext_resource` or `sub_resource` heading declares, one entry per kind and id. A
 * repeated id keeps its first heading, as the renderer's `SubResourceResolver` resolves it.
 */
export function declaredResources(document: LanguageDocument): ReadonlyMap<string, ResourceDeclaration> {
  const declared = new Map<string, ResourceDeclaration>();
  for (const section of document.sections) {
    const id = declaredId(section);
    if (!id) continue;
    const key = declarationKey(id);
    if (!declared.has(key)) declared.set(key, { ...id, section });
  }
  return declared;
}

/** The heading that declares `reference`, or undefined for an id the file never declares. */
export function declarationOf(
  document: LanguageDocument,
  reference: ResourceReference
): DocumentSection | undefined {
  return declaredResources(document).get(declarationKey(reference))?.section;
}

/** The reference or declaration the cursor touches, or undefined. */
export function referenceAt(
  document: LanguageDocument,
  line: number,
  character: number
): ResourceReference | undefined {
  const text = document.lines[line] ?? '';
  const section = document.sectionAt(line + 1);
  if (section && section.headingLine === line + 1) {
    const id = declaredId(section);
    if (id) {
      const attribute = headingAttribute(text, 'id');
      if (attribute && character >= attribute.span.start && character <= attribute.span.end) return id;
    }
  }
  const span = referencesOnLine(text, line).find(
    ({ range }) => character >= range.start.character && character <= range.end.character
  );
  return span && { kind: span.kind, id: span.id };
}
