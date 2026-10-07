/**
 * `ExtResource("…")` and `SubResource("…")` references, as an editor sees them: the
 * declaration each id names, every use of it, and the span a cursor can land on. The
 * ids are per file and per kind, so an `ext` id and a `sub` id may share a spelling.
 * The grammar is `godot/resourceRef.ts`, the one the linter and the renderer read.
 */

import {
  openResourceRef,
  resourceRef,
  resourceRefSpansByLine,
  type ResourceRef,
} from '../godot/resourceRef.js';
import type { LanguageDocument, DocumentSection } from './document.js';
import { headingAttribute, lineRange, lineRangeContains, spanContains } from './ranges.js';
import type { Position, Range } from './types.js';

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
function declaredReference(section: DocumentSection): ResourceReference | undefined {
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

/** Written only by {@link referencesByLine}. An entry lives as long as its document. */
const referencesByDocument = new WeakMap<LanguageDocument, readonly ResourceReferenceSpan[][]>();

/** The reference occurrences on each zero-based line, read once per document. */
function referencesByLine(document: LanguageDocument): readonly ResourceReferenceSpan[][] {
  let byLine = referencesByDocument.get(document);
  if (!byLine) {
    byLine = resourceRefSpansByLine(document.lines).map((spans, lineIndex) =>
      spans.map((span) => ({
        ...toReference(span),
        range: lineRange(lineIndex, { start: span.start, end: span.end }),
      }))
    );
    referencesByDocument.set(document, byLine);
  }
  return byLine;
}

/** Every reference occurrence in the file, declaration headings' `instance=` included. */
export function resourceReferences(document: LanguageDocument): readonly ResourceReferenceSpan[] {
  return referencesByLine(document).flat();
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
    const reference = declaredReference(section);
    if (!reference) continue;
    const key = declarationKey(reference);
    if (!declared.has(key)) declared.set(key, { ...reference, section });
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

/** The id a declaration heading names, when the cursor is on its `id=` value. */
function declarationIdAt(
  section: DocumentSection,
  lineText: string,
  character: number
): ResourceReference | undefined {
  const reference = declaredReference(section);
  if (!reference) return undefined;
  const attribute = headingAttribute(lineText, 'id');
  return attribute && spanContains(attribute.span, character) ? reference : undefined;
}

/** The reference or declaration a zero-based position touches, or undefined. */
export function referenceAt(document: LanguageDocument, position: Position): ResourceReference | undefined {
  const lineText = document.lines[position.line] ?? '';
  const section = document.sectionAt(position.line + 1);
  if (section && section.headingLine === position.line + 1) {
    const declared = declarationIdAt(section, lineText, position.character);
    if (declared) return declared;
  }
  const span = (referencesByLine(document)[position.line] ?? []).find(({ range }) =>
    lineRangeContains(range, position.character)
  );
  return span && { kind: span.kind, id: span.id };
}
