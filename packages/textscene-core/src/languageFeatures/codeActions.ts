/**
 * Quick fixes computed from a document alone, so a host needs no diagnostic to offer
 * them: a deprecated property spelling renamed to the engine's, a property key or a
 * class name repaired to its nearest catalogued spelling. A fix never invents a name;
 * every target comes from the deprecated table or the ClassDB captures.
 */

import { canonicalPropertyName, isDeprecatedPropertyName } from '../godot/deprecated.js';
import { classProperties, isKnownClass, nodeClassNames, resourceClassNames } from './classInfo.js';
import type { DocumentSection, LanguageDocument } from './document.js';
import { nearestName } from './nearest.js';
import { headingAttribute, lineRange, propertyKeySpan } from './ranges.js';
import type { CodeAction, Range, TextEdit } from './types.js';

/** How far a typo may sit from a catalogued name before a fix leaves it alone. */
const MAX_TYPO_DISTANCE = 2;

function overlaps(range: Range | undefined, startLine: number, endLine: number): boolean {
  if (!range) return true;
  return range.start.line <= endLine - 1 && range.end.line >= startLine - 1;
}

function renameAction(title: string, edit: TextEdit): CodeAction {
  return { title, kind: 'quickfix', edit: [edit] };
}

/** Fixes for one section's property keys. */
function propertyActions(document: LanguageDocument, section: DocumentSection): CodeAction[] {
  const className = section.attributes.type;
  if (!className || !isKnownClass(className)) return [];
  const known = classProperties(className).map((property) => property.name);
  const knownSet = new Set(known);
  const actions: CodeAction[] = [];

  for (const property of section.properties) {
    const line = document.lines[property.startLine - 1];
    if (line === undefined) continue;
    const key = propertyKeySpan(line);
    if (!key) continue;

    if (isDeprecatedPropertyName(className, property.key)) {
      const canonical = canonicalPropertyName(className, property.key, property.value);
      if (canonical !== property.key) {
        actions.push(
          renameAction(`Rename deprecated '${property.key}' to '${canonical}'`, {
            range: lineRange(property.startLine - 1, key.span),
            newText: canonical,
          })
        );
      }
      continue;
    }

    if (!knownSet.has(property.storedKey)) {
      const nearest = nearestName(property.key, known, MAX_TYPO_DISTANCE);
      if (nearest) {
        actions.push(
          renameAction(`Change '${property.key}' to '${nearest}'`, {
            range: lineRange(property.startLine - 1, key.span),
            newText: nearest,
          })
        );
      }
    }
  }
  return actions;
}

/** A fix for a heading's unknown `type=`, against the names that class of heading may use. */
function typeAction(document: LanguageDocument, section: DocumentSection): CodeAction | undefined {
  const className = section.attributes.type;
  if (!className || isKnownClass(className)) return undefined;
  const line = document.lines[section.headingLine - 1];
  if (line === undefined) return undefined;
  const attribute = headingAttribute(line, 'type');
  if (!attribute) return undefined;
  const candidates = section.tag === 'node' ? nodeClassNames() : resourceClassNames();
  const nearest = nearestName(className, candidates, MAX_TYPO_DISTANCE);
  if (!nearest) return undefined;
  return renameAction(`Change '${className}' to '${nearest}'`, {
    range: lineRange(section.headingLine - 1, attribute.span),
    newText: nearest,
  });
}

/**
 * Every quick fix for the document, or for the sections a zero-based range overlaps.
 * An omitted range returns every fix in the file, which the CLI surfaces and a host
 * narrows with the cursor.
 */
export function codeActions(document: LanguageDocument, range?: Range): readonly CodeAction[] {
  const actions: CodeAction[] = [];
  for (const section of document.sections) {
    if (section.kind === 'other') continue;
    if (!overlaps(range, section.headingLine, section.endLine)) continue;
    const type = typeAction(document, section);
    if (type) actions.push(type);
    actions.push(...propertyActions(document, section));
  }
  return actions;
}
