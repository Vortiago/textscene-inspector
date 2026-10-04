/**
 * Completion for the four things a `.tscn` writer reaches for: a class on a heading's
 * `type=`, a node name on `parent=`, a property key, and a value the property's hint
 * enumerates. A reference to a resource id completes from the file's own headings, and
 * a `res://` path completes through the host's listing when one is supplied.
 */

import { isDeprecatedPropertyName } from '../godot/deprecated.js';
import { VARIANT_TYPE, variantTypeName } from '../godot/variantType.js';
import {
  classChain,
  classProperties,
  findClassProperty,
  nodeClassNames,
  resourceClassNames,
} from './classInfo.js';
import type { DocumentSection, LanguageDocument, PropertySlot } from './document.js';
import { enumEntries, isEnumHint } from './hints.js';
import { declaredResourceIds } from './resourceRefs.js';
import { headingAttribute, propertyKeySpan } from './ranges.js';
import type { CompletionItem } from './types.js';

/** The seam a completion host supplies: it lists the workspace's `res://` paths. */
export interface CompletionContext {
  readonly listPaths?: () => readonly string[];
}

function extendsDetail(className: string): string {
  const chain = classChain(className);
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
  if (!resolved || !isEnumHint(resolved.hint) || resolved.type !== VARIANT_TYPE.INT) return [];
  return enumEntries(resolved.hintString).map((entry) => ({
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
  kind: 'ext' | 'sub',
  prefix: string
): readonly CompletionItem[] {
  const items: CompletionItem[] = [];
  for (const [key, section] of declaredResourceIds(document)) {
    const [declaredKind, id] = key.split(':', 2) as [string, string];
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

function headingItems(section: DocumentSection, attribute: string): readonly CompletionItem[] {
  if (attribute === 'type') {
    if (section.tag === 'node') return typeItems(nodeClassNames(), 'nodeType');
    return typeItems(resourceClassNames(), 'resourceType');
  }
  return [];
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
  const reference = /(Ext|Sub)Resource\(\s*"([^"]*)$/.exec(before);
  if (reference) {
    const prefix = reference[2] ?? '';
    return resourceIdItems(document, reference[1] === 'Ext' ? 'ext' : 'sub', prefix);
  }
  const className = section.attributes.type;
  if (className) {
    const enums = enumItems(className, property);
    if (enums.length > 0) return enums;
    const booleans = booleanItems(className, property);
    if (booleans.length > 0) return booleans;
  }
  if (context?.listPaths) {
    const path = /res:\/\/[^"]*$/.exec(before);
    if (path) return pathItems(context.listPaths, path[0]);
  }
  return [];
}

/**
 * Completions at a zero-based position. An empty result means the position offers
 * nothing, which a host shows as no popup.
 */
export function completionsAt(
  document: LanguageDocument,
  position: { line: number; character: number },
  context?: CompletionContext
): readonly CompletionItem[] {
  const line = document.lines[position.line];
  if (line === undefined) return [];
  const section = document.sectionAt(position.line + 1);
  if (!section) return [];

  if (section.headingLine === position.line + 1) {
    for (const attribute of ['type', 'parent'] as const) {
      const found = headingAttribute(line, attribute);
      if (!found || position.character < found.span.start || position.character > found.span.end) continue;
      if (attribute === 'parent') return parentItems(document);
      return headingItems(section, attribute);
    }
    return [];
  }

  const location = document.propertyAt(position.line + 1);
  if (!location) return [];
  const property = location.property;
  const className = location.section.attributes.type;

  const onFirstLine = property.startLine === position.line + 1;
  const key = propertyKeySpan(line);
  if (onFirstLine && key && position.character <= key.span.end) {
    if (!className) return [];
    const present = new Set(location.section.properties.map((slot) => slot.storedKey));
    return propertyItems(className, present);
  }
  return valueItems(document, location.section, property, line, position.character, context);
}
