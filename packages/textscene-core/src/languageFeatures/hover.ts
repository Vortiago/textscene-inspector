/**
 * Hover for the three places a reader asks about: a node or resource class on a
 * heading, a property key, and a value that names a resource or an enum label. Each
 * answer comes from the committed ClassDB rows, the deprecated-alias table or the
 * file's own headings, so it states what Godot does rather than a guess.
 */

import { canonicalPropertyName, isDeprecatedPropertyName } from '../godot/deprecated.js';
import { variantTypeName } from '../godot/variantType.js';
import { classBaseChain } from '../godot/classBaseTypes.js';
import { findClassProperty, isKnownClass, slotProperty, type ClassProperty } from './classInfo.js';
import { classDocsUrl, propertyDocsUrl } from './docs.js';
import type { DocumentSection, LanguageDocument, PropertyLocation, PropertySlot } from './document.js';
import { acceptedResourceTypes, enumEntriesOf, flagLabels, rangeHint, rangeSuffix } from './hints.js';
import { headingAttribute, lineRange, propertyKeySpan, propertyValueSpan, spanContains } from './ranges.js';
import { declarationOf, referenceInValue, type ResourceReference } from './resourceRefs.js';
import type { Hover, Position, Range } from './types.js';

function codeSpan(text: string): string {
  return `\`${text}\``;
}

/** The answer for a heading's `type=`: the class, its chain and its reference page. */
function classHover(className: string, range: Range): Hover | undefined {
  if (!isKnownClass(className)) return undefined;
  const chain = classBaseChain(className);
  const lines = [
    `**${className}**`,
    '',
    chain.length > 0 ? `Godot class, extends ${chain.map(codeSpan).join(' → ')}.` : 'Godot class.',
    '',
    `[Class reference](${classDocsUrl(className)})`,
  ];
  return { markdown: lines.join('\n'), range };
}

/** The bounds of a range hint, with its unit when it names one. */
function rangeText(hint: number, hintString: string): string | undefined {
  const bounds = rangeHint(hint, hintString);
  if (!bounds) return undefined;
  const suffix = rangeSuffix(hint, hintString);
  const unit = suffix ? ` ${suffix}` : '';
  const left = bounds.hasMin ? bounds.min : '−∞';
  const right = bounds.hasMax ? bounds.max : '∞';
  return `Range ${left}..${right}${unit}.`;
}

/** What a property accepts, from its hint. */
function acceptedText(property: ClassProperty): string | undefined {
  const { hint, hintString } = property;
  const entries = enumEntriesOf(property);
  if (entries.length > 0)
    return `One of ${entries.map((entry) => `${codeSpan(entry.label)} (${entry.value})`).join(', ')}.`;
  const resources = acceptedResourceTypes(hint, hintString);
  if (resources) return `A resource of ${resources.map(codeSpan).join(' or ')}.`;
  const flags = flagLabels(hint, hintString);
  if (flags) return `A bitmask of ${flags.map(codeSpan).join(', ')}.`;
  return rangeText(hint, hintString);
}

/** The engine spelling a deprecated key resolves to, or undefined for a current key. */
function deprecationNote(className: string, property: PropertySlot): string | undefined {
  if (!isDeprecatedPropertyName(className, property.key)) return undefined;
  const canonical = canonicalPropertyName(className, property.key, property.value);
  if (canonical === property.key) return undefined;
  return `Deprecated spelling: Godot applies it as ${codeSpan(canonical)}.`;
}

/** The answer for a property key: its type, declaring class, hint and reference page. */
function propertyHover(section: DocumentSection, property: PropertySlot, range: Range): Hover {
  const className = section.ownerType;
  const resolved = className
    ? (findClassProperty(className, property.key) ?? findClassProperty(className, property.storedKey))
    : undefined;
  const typeName = resolved ? variantTypeName(resolved.type) : undefined;
  const lines = [`**${property.key}**${typeName ? ` ${codeSpan(typeName)}` : ''}`];
  if (resolved) {
    lines.push('', `Declared by ${codeSpan(resolved.declaredBy)}.`);
    const accepted = acceptedText(resolved);
    if (accepted) lines.push('', accepted);
  }
  const deprecation = className ? deprecationNote(className, property) : undefined;
  if (deprecation) lines.push('', deprecation);
  if (resolved) lines.push('', `[Reference](${propertyDocsUrl(resolved.declaredBy, resolved.name)})`);
  return { markdown: lines.join('\n'), range };
}

/** The answer for a reference value: the declaration its id names, or that none does. */
function referenceHover(document: LanguageDocument, reference: ResourceReference, range: Range): Hover {
  const declaration = declarationOf(document, reference);
  const noun = reference.kind === 'ext' ? 'External resource' : 'Sub-resource';
  if (!declaration)
    return { markdown: `${noun} ${codeSpan(reference.id)} is not declared in this file.`, range };
  const type = declaration.attributes.type ?? 'Resource';
  const path = declaration.attributes.path;
  const lines = [`${noun} ${codeSpan(reference.id)}: ${codeSpan(type)}`];
  if (path) lines.push('', codeSpan(path));
  return { markdown: lines.join('\n'), range };
}

/** The answer for an enum value: the label it stands for. */
function enumLabelHover(location: PropertyLocation, range: Range): Hover | undefined {
  const declared = slotProperty(location);
  if (!declared) return undefined;
  const written = location.property.value.trim();
  // The label lookup is a string compare: the hint's value is the literal to write,
  // so no second Variant number reader is needed.
  const entry = enumEntriesOf(declared).find((candidate) => candidate.value === written);
  return entry && { markdown: `**${entry.label}** = ${codeSpan(written)}`, range };
}

/** The answer for a value: the declaration a reference names, or an enum label. */
function valueHover(document: LanguageDocument, location: PropertyLocation, range: Range): Hover | undefined {
  const reference = referenceInValue(location.property.value);
  if (reference) return referenceHover(document, reference, range);
  return enumLabelHover(location, range);
}

/**
 * Hover at a zero-based position, or undefined where the position names nothing. The
 * document model counts lines from one. See `document.ts`.
 */
export function hoverAt(document: LanguageDocument, position: Position): Hover | undefined {
  const line = document.lines[position.line];
  if (line === undefined) return undefined;
  const documentLine = position.line + 1;
  const section = document.sectionAt(documentLine);
  if (!section) return undefined;

  if (section.headingLine === documentLine) {
    const type = headingAttribute(line, 'type');
    if (!type || !spanContains(type.span, position.character)) return undefined;
    return classHover(type.value, lineRange(position.line, type.span));
  }

  const location = document.propertyAt(documentLine);
  if (!location) return undefined;

  // A property's key sits on its first line, so a continuation line of a multiline value
  // must not read as a new property.
  const isOnFirstLine = location.property.startLine === documentLine;
  const key = propertyKeySpan(line);
  if (isOnFirstLine && key && spanContains(key.span, position.character)) {
    return propertyHover(location.section, location.property, lineRange(position.line, key.span));
  }
  if (location.property.isMultiline) return undefined;
  const value = propertyValueSpan(line);
  if (!value || !spanContains(value.span, position.character)) return undefined;
  return valueHover(document, location, lineRange(position.line, value.span));
}
