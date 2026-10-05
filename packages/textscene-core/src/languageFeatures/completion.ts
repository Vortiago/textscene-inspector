/**
 * Completion for the four things a `.tscn` writer reaches for: a class on a heading's
 * `type=`, a node name on `parent=`, a property key, and a value the property's hint
 * enumerates. A reference to a resource id completes from the file's own headings, and
 * a `res://` path completes through the host's listing when one is supplied.
 */

import { isDeprecatedPropertyName } from '../godot/deprecated.js';
import { VARIANT_TYPE, variantTypeName } from '../godot/variantType.js';
import { classBaseChain } from '../godot/classBaseTypes.js';
import { classProperties, findClassProperty, nodeClassNames, resourceClassNames } from './classInfo.js';
import type { DocumentSection, LanguageDocument, PropertySlot } from './document.js';
import { enumEntriesOf } from './hints.js';
import { declaredResources, openReferenceAt, type ResourceRefKind } from './resourceRefs.js';
import { headingAttribute, propertyKeySpan } from './ranges.js';
import type { CompletionItem, Position } from './types.js';

/**
 * The characters a host asks for completion on: a quote opens a class or a path, `=` a
 * value, the rest a key or an id.
 */
export const COMPLETION_TRIGGER_CHARACTERS: readonly string[] = ['"', '=', '.', '/', '('];

/** The seam an editor host supplies: it lists the workspace's `res://` paths. */
export interface CompletionContext {
  readonly listPaths?: () => readonly string[];
}

function extendsDetail(className: string): string {
  const chain = classBaseChain(className);
  return chain.length > 0 ? `extends ${chain[0]}` : 'Godot class';
}

function typeItems(names: readonly string[], kind: 'nodeType' | 'resourceType'): readonly CompletionItem[] {
  return names.map((name) => ({ label: name, kind, detail: extendsDetail(name) }));
}

function propertyItems(className: string, present: ReadonlySet<string>): readonly CompletionItem[] {
  return classProperties(className)
    .filter((property) => !present.has(property.name))
    .map((property) => ({
      label: property.name,
      kind: 'property',
      detail: variantTypeName(property.type),
      deprecated: isDeprecatedPropertyName(className, property.name),
    }));
}

function enumItems(className: string, property: PropertySlot): readonly CompletionItem[] {
  const resolved = findClassProperty(className, property.storedKey);
  if (!resolved) return [];
  return enumEntriesOf(resolved).map((entry) => ({
    label: entry.label,
    kind: 'value',
    detail: `= ${entry.value}`,
    insertText: entry.value,
  }));
}

function booleanItems(className: string, property: PropertySlot): readonly CompletionItem[] {
  const resolved = findClassProperty(className, property.storedKey);
  if (!resolved || resolved.type !== VARIANT_TYPE.BOOL) return [];
  return [
    { label: 'true', kind: 'value' },
    { label: 'false', kind: 'value' },
  ];
}

/** Ids of the references' own kind, offered inside `ExtResource("…")` or `SubResource("…")`. */
function resourceIdItems(
  document: LanguageDocument,
  kind: ResourceRefKind,
  prefix: string
): readonly CompletionItem[] {
  const items: CompletionItem[] = [];
  for (const { kind: declaredKind, id, section } of declaredResources(document).values()) {
    if (declaredKind !== kind || !id.startsWith(prefix)) continue;
    const type = section.attributes.type ?? 'Resource';
    const path = section.attributes.path;
    items.push({ label: id, kind: 'resourceId', detail: type, documentation: path, insertText: id });
  }
  return items;
}

/** Paths under `res://` that start with the prefix already typed. */
function pathItems(listPaths: () => readonly string[], prefix: string): readonly CompletionItem[] {
  return listPaths()
    .filter((path) => path.startsWith(prefix))
    .map((path) => ({ label: path, kind: 'path', insertText: path }));
}

function classNameItems(section: DocumentSection): readonly CompletionItem[] {
  if (section.tag === 'node') return typeItems(nodeClassNames(), 'nodeType');
  return typeItems(resourceClassNames(), 'resourceType');
}

function parentItems(document: LanguageDocument): readonly CompletionItem[] {
  const names = document.sections
    .filter((section) => section.kind === 'node' && section.attributes.name)
    .map((section) => section.attributes.name as string);
  return [...new Set(['.', ...names])]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      label: name,
      kind: 'nodeName' as const,
      detail: name === '.' ? 'scene root' : 'node',
    }));
}

function valueItems(
  document: LanguageDocument,
  section: DocumentSection,
  property: PropertySlot,
  cursorLine: string,
  character: number,
  context: CompletionContext | undefined
): readonly CompletionItem[] {
  const before = cursorLine.slice(0, character);
  const reference = openReferenceAt(before);
  if (reference) return resourceIdItems(document, reference.kind, reference.id);
  const className = section.ownerType;
  if (className) {
    const enums = enumItems(className, property);
    if (enums.length > 0) return enums;
    const booleans = booleanItems(className, property);
    if (booleans.length > 0) return booleans;
  }
  const prefix = resPathPrefix(before);
  if (context?.listPaths && prefix !== undefined) return pathItems(context.listPaths, prefix);
  return [];
}

/** The `res://` path a value has typed up to the cursor, or undefined outside one. */
function resPathPrefix(textBeforeCursor: string): string | undefined {
  return /res:\/\/[^"]*$/.exec(textBeforeCursor)?.[0];
}

/**
 * Whether a completion at a zero-based position would read the host's path listing, so a
 * host lists the project only for a cursor inside a `res://` value.
 */
export function needsPathListing(document: LanguageDocument, position: Position): boolean {
  const line = document.lines[position.line];
  const location = document.propertyAt(position.line + 1);
  if (line === undefined || !location) return false;
  return resPathPrefix(line.slice(0, position.character)) !== undefined;
}

/**
 * Completions at a zero-based position. An empty result means the position offers
 * nothing, which a host shows as no popup.
 */
export function completionsAt(
  document: LanguageDocument,
  position: Position,
  context?: CompletionContext
): readonly CompletionItem[] {
  const line = document.lines[position.line];
  if (line === undefined) return [];
  const section = document.sectionAt(position.line + 1);
  if (!section) return [];

  if (section.headingLine === position.line + 1) {
    const within = (attribute: string): boolean => {
      const found = headingAttribute(line, attribute);
      return (
        found !== undefined && position.character >= found.span.start && position.character <= found.span.end
      );
    };
    if (within('type')) return classNameItems(section);
    if (within('parent')) return parentItems(document);
    return [];
  }

  const location = document.propertyAt(position.line + 1);
  if (!location) return [];
  const property = location.property;
  const className = location.section.ownerType;

  const onFirstLine = property.startLine === position.line + 1;
  const key = propertyKeySpan(line);
  if (onFirstLine && key && position.character <= key.span.end) {
    if (!className) return [];
    const present = new Set(location.section.properties.map((slot) => slot.storedKey));
    return propertyItems(className, present);
  }
  return valueItems(document, location.section, property, line, position.character, context);
}
