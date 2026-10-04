/**
 * Hover for the three places a reader asks about: a node or resource class on a
 * heading, a property key, and a value that names a resource or an enum label. Each
 * answer comes from the committed ClassDB rows, the deprecated-alias table or the
 * file's own headings, so it states what the engine does rather than a guess.
 */

import { canonicalPropertyName, isDeprecatedPropertyName } from '../godot/deprecated.js';
import { VARIANT_TYPE, variantTypeName } from '../godot/variantType.js';
import { classChain, findClassProperty, isKnownClass } from './classInfo.js';
import { classDocsUrl, propertyDocsUrl } from './docs.js';
import type { DocumentSection, LanguageDocument, PropertySlot } from './document.js';
import { enumEntries, flagLabels, isEnumHint, rangeHint, rangeSuffix, resourceTypeHint } from './hints.js';
import { headingAttribute, lineRange, propertyKeySpan, propertyValueSpan, type LineSpan } from './ranges.js';
import { declaredResourceIds, parseResourceReference } from './resourceRefs.js';
import type { Hover, Range } from './types.js';

function within(span: LineSpan, character: number): boolean {
  return character >= span.start && character <= span.end;
}

function codeSpan(text: string): string {
  return `\`${text}\``;
}

/** The answer for a heading's `type=`: the class, its chain and its reference page. */
function classHover(className: string, range: Range): Hover | undefined {
  if (!isKnownClass(className)) return undefined;
  const chain = classChain(className);
  const lines = [
    `**${className}**`,
    '',
    chain.length > 0 ? `Godot class, extends ${chain.map(codeSpan).join(' → ')}.` : 'Godot class.',
  ];
  lines.push('', `[Class reference](${classDocsUrl(className)})`);
  return { markdown: lines.join('\n'), range };
}

/** What a property accepts, from its hint. */
function acceptedText(type: number, hint: number, hintString: string): string | undefined {
  if (isEnumHint(hint) && type === VARIANT_TYPE.INT) {
    const entries = enumEntries(hintString);
    if (entries.length > 0)
      return `One of ${entries.map((entry) => `${codeSpan(entry.label)} (${entry.value})`).join(', ')}.`;
  }
  const resources = resourceTypeHint(hint, hintString);
  if (resources) return `A resource of ${resources.map(codeSpan).join(' or ')}.`;
  const flags = flagLabels(hint, hintString);
  if (flags) return `A bitmask of ${flags.map(codeSpan).join(', ')}.`;
  const bounds = rangeHint(hint, hintString);
  if (bounds) {
    const suffix = rangeSuffix(hint, hintString);
    const unit = suffix ? ` ${suffix}` : '';
    const left = bounds.hasMin ? bounds.min : '−∞';
    const right = bounds.hasMax ? bounds.max : '∞';
    return `Range ${left}..${right}${unit}.`;
  }
  return undefined;
}

/** The answer for a property key: its type, declaring class, hint and reference page. */
function propertyHover(section: DocumentSection, property: PropertySlot, range: Range): Hover | undefined {
  const className = section.attributes.type;
  const resolved = className
    ? (findClassProperty(className, property.key) ?? findClassProperty(className, property.storedKey))
    : undefined;
  const lines: string[] = [];
  const typeName = resolved ? variantTypeName(resolved.type) : undefined;
  lines.push(`**${property.key}**${typeName ? ` ${codeSpan(typeName)}` : ''}`);
  if (resolved) {
    lines.push('', `Declared by ${codeSpan(resolved.declaredBy)}.`);
    const accepted = acceptedText(resolved.type, resolved.hint, resolved.hintString);
    if (accepted) lines.push('', accepted);
  }
  if (className && isDeprecatedPropertyName(className, property.key)) {
    const canonical = canonicalPropertyName(className, property.key, property.value);
    if (canonical !== property.key) {
      lines.push('', `Deprecated spelling: the engine applies it as ${codeSpan(canonical)}.`);
    }
  }
  if (resolved) lines.push('', `[Reference](${propertyDocsUrl(resolved.declaredBy, resolved.name)})`);
  return { markdown: lines.join('\n'), range };
}

/** The answer for a value: the declaration a reference names, or an enum label. */
function valueHover(
  document: LanguageDocument,
  section: DocumentSection,
  property: PropertySlot,
  range: Range
): Hover | undefined {
  const className = section.attributes.type;
  const declared = className ? findClassProperty(className, property.storedKey) : undefined;

  const reference = parseResourceReference(property.value);
  if (reference) {
    const declaration = declaredResourceIds(document).get(`${reference.kind}:${reference.id}`);
    const noun = reference.kind === 'ext' ? 'External resource' : 'Sub-resource';
    if (!declaration)
      return { markdown: `${noun} ${codeSpan(reference.id)} is not declared in this file.`, range };
    const type = declaration.attributes.type ?? 'Resource';
    const path = declaration.attributes.path;
    const lines = [`${noun} ${codeSpan(reference.id)}: ${codeSpan(type)}`];
    if (path) lines.push('', codeSpan(path));
    return { markdown: lines.join('\n'), range };
  }

  if (declared && isEnumHint(declared.hint) && declared.type === VARIANT_TYPE.INT) {
    const value = Number.parseInt(property.value.trim(), 10);
    const entry = enumEntries(declared.hintString).find(
      (candidate) => Number.parseInt(candidate.value, 10) === value
    );
    if (entry) return { markdown: `**${entry.label}** = ${codeSpan(property.value.trim())}`, range };
  }
  return undefined;
}

/**
 * Hover at a zero-based position, or undefined where the position names nothing.
 * The position's line is one-based inside the document model; see `document.ts`.
 */
export function hoverAt(
  document: LanguageDocument,
  position: { line: number; character: number }
): Hover | undefined {
  const line = document.lines[position.line];
  if (line === undefined) return undefined;
  const section = document.sectionAt(position.line + 1);
  if (!section) return undefined;

  if (section.headingLine === position.line + 1) {
    const type = headingAttribute(line, 'type');
    if (type && within(type.span, position.character)) {
      return classHover(type.value, lineRange(position.line, type.span));
    }
    return undefined;
  }

  const location = document.propertyAt(position.line + 1);
  if (!location) return undefined;

  const key = propertyKeySpan(line);
  if (key && within(key.span, position.character)) {
    return propertyHover(location.section, location.property, lineRange(position.line, key.span));
  }
  if (!location.property.isMultiline) {
    const value = propertyValueSpan(line);
    if (value && within(value.span, position.character)) {
      return valueHover(document, location.section, location.property, lineRange(position.line, value.span));
    }
  }
  return undefined;
}
