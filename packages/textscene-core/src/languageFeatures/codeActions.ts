/**
 * Quick fixes computed from a document alone, so a host needs no diagnostic to offer
 * them: a deprecated property spelling renamed to the engine's, a property key or a
 * class name repaired to its nearest catalogued spelling. A fix never invents a name.
 * Every target comes from the deprecated table or the ClassDB captures.
 */

import { canonicalPropertyName, isDeprecatedPropertyName } from '../godot/deprecated.js';
import { classProperties, isKnownClass, nodeClassNames, resourceClassNames } from './classInfo.js';
import type { DocumentSection, LanguageDocument, PropertySlot } from './document.js';
import { nearestName } from './nearest.js';
import { headingAttribute, lineRange, propertyKeySpan } from './ranges.js';
import type { CodeAction, Range } from './types.js';

/** How far a typo may sit from a catalogued name before a fix leaves it alone. */
const MAX_TYPO_DISTANCE = 2;

/** Whether a zero-based range touches a section, whose lines count from one. */
function overlaps(range: Range, section: DocumentSection): boolean {
  return range.start.line <= section.endLine - 1 && range.end.line >= section.headingLine - 1;
}

/** Whether a zero-based range covers a line the document model counts from one. */
function coversLine(range: Range, documentLine: number): boolean {
  return range.start.line <= documentLine - 1 && documentLine - 1 <= range.end.line;
}

/** Whether a section sets `script`, whose exported properties a ClassDB row does not list. */
function hasScript(section: DocumentSection): boolean {
  return section.properties.some((property) => property.storedKey === 'script');
}

function renameAction(title: string, range: Range, newText: string): CodeAction {
  return { title, edit: [{ range, newText }] };
}

/** The rename of a deprecated key to the engine's spelling, when the two differ. */
function deprecatedKeyAction(
  className: string,
  property: PropertySlot,
  keyRange: Range
): CodeAction | undefined {
  const canonical = canonicalPropertyName(className, property.key, property.value);
  if (canonical === property.key) return undefined;
  return renameAction(`Rename deprecated '${property.key}' to '${canonical}'`, keyRange, canonical);
}

/** The repair of a mistyped key to the nearest property the class declares. */
function typoKeyAction(key: string, known: readonly string[], keyRange: Range): CodeAction | undefined {
  const nearest = nearestName(key, known, MAX_TYPO_DISTANCE);
  return nearest ? renameAction(`Change '${key}' to '${nearest}'`, keyRange, nearest) : undefined;
}

/**
 * Fixes for the property keys a range covers in one section. A key the class does not declare
 * may be a script's exported property, so a section with a script gets no typo repair.
 */
function propertyActions(document: LanguageDocument, section: DocumentSection, range: Range): CodeAction[] {
  const className = section.ownerType;
  if (!className || !isKnownClass(className)) return [];
  const known = classProperties(className).map((property) => property.name);
  const knownSet = new Set(known);
  const canRepairTypos = !hasScript(section);
  const actions: CodeAction[] = [];

  for (const property of section.properties) {
    if (!coversLine(range, property.startLine)) continue;
    const line = document.lines[property.startLine - 1];
    const key = line === undefined ? undefined : propertyKeySpan(line);
    if (!key) continue;
    const keyRange = lineRange(property.startLine - 1, key.span);
    // A deprecated key is a spelling the engine reads, so it is never a typo.
    if (isDeprecatedPropertyName(className, property.key)) {
      const rename = deprecatedKeyAction(className, property, keyRange);
      if (rename) actions.push(rename);
      continue;
    }
    if (!canRepairTypos || knownSet.has(property.storedKey)) continue;
    const repair = typoKeyAction(property.key, known, keyRange);
    if (repair) actions.push(repair);
  }
  return actions;
}

/** A fix for a heading's unknown `type=`, when the range covers the heading line. */
function typeAction(
  document: LanguageDocument,
  section: DocumentSection,
  range: Range
): CodeAction | undefined {
  const className = section.attributes.type;
  if (!className || isKnownClass(className) || !coversLine(range, section.headingLine)) return undefined;
  const line = document.lines[section.headingLine - 1];
  if (line === undefined) return undefined;
  const attribute = headingAttribute(line, 'type');
  if (!attribute) return undefined;
  const candidates = section.tag === 'node' ? nodeClassNames() : resourceClassNames();
  const nearest = nearestName(className, candidates, MAX_TYPO_DISTANCE);
  if (!nearest) return undefined;
  return renameAction(
    `Change '${className}' to '${nearest}'`,
    lineRange(section.headingLine - 1, attribute.span),
    nearest
  );
}

/** Every quick fix for the lines a zero-based range covers. */
export function codeActions(document: LanguageDocument, range: Range): readonly CodeAction[] {
  const actions: CodeAction[] = [];
  for (const section of document.sections) {
    if (section.kind === 'other' || !overlaps(range, section)) continue;
    const type = typeAction(document, section, range);
    if (type) actions.push(type);
    actions.push(...propertyActions(document, section, range));
  }
  return actions;
}
