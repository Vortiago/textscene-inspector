/**
 * Completion for the four things a `.tscn` writer reaches for: a class on a heading's
 * `type=`, a node name on `parent=`, a property key, and a value the property's hint
 * enumerates. A reference to a resource id completes from the file's own headings, and
 * a `res://` path completes through the host's listing when one is supplied.
 */

import { isDeprecatedPropertyName } from '../godot/deprecated.js';
import { VARIANT_TYPE, variantTypeName } from '../godot/variantType.js';
import { classBaseChain } from '../godot/classBaseTypes.js';
import {
  classProperties,
  nodeClassNames,
  resourceClassNames,
  slotProperty,
  type ClassProperty,
} from './classInfo.js';
import type { DocumentSection, LanguageDocument, PropertyLocation } from './document.js';
import { enumEntriesOf } from './hints.js';
import { declaredResources, openReferenceAt, type ResourceRefKind } from './resourceRefs.js';
import { nodePathOf, ROOT_PATH } from './nodePath.js';
import { headingAttribute, propertyKeySpan, spanContains } from './ranges.js';
import type { CompletionItem, Position } from './types.js';

/**
 * A line outside every property that holds one word and no `=` yet: a key being typed. A
 * blank line does not match, so it offers nothing.
 */
const PARTIAL_KEY_RE = /^\s*[A-Za-z_][\w/]*$/;

/**
 * The characters a host asks for completion on: a quote opens a class or a path, `=` a
 * value, the rest a key or an id.
 */
export const COMPLETION_TRIGGER_CHARACTERS: readonly string[] = ['"', '=', '.', '/', '('];

/**
 * The seam an editor host supplies: it lists the project's `res://` paths. The engine calls it
 * only for a cursor inside a `res://` value, so a host lists the project only when one is asked for.
 */
export interface CompletionContext {
  readonly listPaths?: () => Promise<readonly string[]>;
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

/** The properties a section's class declares and the section does not set yet. */
function keyItems(section: DocumentSection): readonly CompletionItem[] {
  if (!section.ownerType) return [];
  const present = new Set(section.properties.map((slot) => slot.storedKey));
  return propertyItems(section.ownerType, present);
}

function enumItems(property: ClassProperty): readonly CompletionItem[] {
  return enumEntriesOf(property).map((entry) => ({
    label: entry.label,
    kind: 'value',
    detail: `= ${entry.value}`,
    insertText: entry.value,
  }));
}

function booleanItems(property: ClassProperty): readonly CompletionItem[] {
  if (property.type !== VARIANT_TYPE.BOOL) return [];
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
async function pathItems(
  listPaths: () => Promise<readonly string[]>,
  prefix: string
): Promise<readonly CompletionItem[]> {
  return (await listPaths())
    .filter((path) => path.startsWith(prefix))
    .map((path) => ({ label: path, kind: 'path', insertText: path }));
}

function classNameItems(section: DocumentSection): readonly CompletionItem[] {
  if (section.tag === 'node') return typeItems(nodeClassNames(), 'nodeType');
  return typeItems(resourceClassNames(), 'resourceType');
}

/**
 * What a heading's `parent=` may name: the path of a node declared above it. Godot creates the
 * nodes in file order and resolves each parent then (`packed_scene.cpp:157-160, 205-213`), so the
 * node itself and every node below it are no parent yet.
 */
function parentItems(document: LanguageDocument, headingLine: number): readonly CompletionItem[] {
  const paths = document.sections
    .filter((section) => section.kind === 'node' && section.headingLine < headingLine)
    .map(nodePathOf)
    .filter((path) => path !== undefined);
  return [...new Set(paths)].map((path) => ({
    label: path,
    kind: 'nodeName' as const,
    detail: path === ROOT_PATH ? 'scene root' : 'node',
  }));
}

/** The values a property's ClassDB row offers: its enum labels, or `true` and `false`. */
function declaredValueItems(location: PropertyLocation): readonly CompletionItem[] {
  const declared = slotProperty(location);
  if (!declared) return [];
  const enums = enumItems(declared);
  return enums.length > 0 ? enums : booleanItems(declared);
}

/** The project paths that start with the `res://` text the cursor ends, or none. */
async function resPathItemsAt(
  textBeforeCursor: string,
  context: CompletionContext | undefined
): Promise<readonly CompletionItem[]> {
  const prefix = /res:\/\/[^"]*$/.exec(textBeforeCursor)?.[0];
  if (!context?.listPaths || prefix === undefined) return [];
  return pathItems(context.listPaths, prefix);
}

async function valueItems(
  document: LanguageDocument,
  location: PropertyLocation,
  textBeforeCursor: string,
  context: CompletionContext | undefined
): Promise<readonly CompletionItem[]> {
  const reference = openReferenceAt(textBeforeCursor);
  if (reference) return resourceIdItems(document, reference.kind, reference.id);
  const declaredValues = declaredValueItems(location);
  if (declaredValues.length > 0) return declaredValues;
  return resPathItemsAt(textBeforeCursor, context);
}

function isOnHeadingAttribute(line: string, key: string, character: number): boolean {
  const attribute = headingAttribute(line, key);
  return attribute !== undefined && spanContains(attribute.span, character);
}

/**
 * The classes a heading's `type=` may name, the nodes its `parent=` may name, the ids an
 * `instance=ExtResource("…")` may name, or the files its `path="res://…"` may name.
 */
async function headingItems(
  document: LanguageDocument,
  section: DocumentSection,
  line: string,
  character: number,
  context: CompletionContext | undefined
): Promise<readonly CompletionItem[]> {
  if (isOnHeadingAttribute(line, 'type', character)) return classNameItems(section);
  if (isOnHeadingAttribute(line, 'parent', character)) return parentItems(document, section.headingLine);
  const textBeforeCursor = line.slice(0, character);
  const reference = openReferenceAt(textBeforeCursor);
  if (reference) return resourceIdItems(document, reference.kind, reference.id);
  return resPathItemsAt(textBeforeCursor, context);
}

/**
 * Completions at a zero-based position. An empty result means the position offers
 * nothing, which a host shows as no popup.
 */
export async function completionsAt(
  document: LanguageDocument,
  position: Position,
  context?: CompletionContext
): Promise<readonly CompletionItem[]> {
  const line = document.lines[position.line];
  if (line === undefined) return [];
  const documentLine = position.line + 1;
  const section = document.sectionAt(documentLine);
  if (!section) return [];
  if (section.headingLine === documentLine) {
    return headingItems(document, section, line, position.character, context);
  }

  const location = document.propertyAt(documentLine);
  if (!location) return PARTIAL_KEY_RE.test(line) ? keyItems(section) : [];

  const isOnFirstLine = location.property.startLine === documentLine;
  const key = propertyKeySpan(line);
  if (isOnFirstLine && key && position.character <= key.span.end) return keyItems(location.section);
  return valueItems(document, location, line.slice(0, position.character), context);
}
