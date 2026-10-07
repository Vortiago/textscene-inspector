/**
 * Resolves a resource path against a parsed `.tres`: the one sub-resource lookup every
 * loader of a path shares, with one error policy. A slice decodes the section it returns.
 */

import type { ParsedResource } from '../parser/parsedResource.js';
import { findSubResource } from './SubResourceResolver.js';
import { parseSubResourcePath } from './subResourcePath.js';

/**
 * The parsed file that owns `path`, a plain path or a **Sub-resource path**, from the
 * `resource` slot's cache. Rejects when the file fails to load or parse.
 */
export type ParsedFileLoaderFn = (path: string) => Promise<ParsedResource>;

/** One resource inside a parsed file: its `[resource]` body or one `[sub_resource]`. */
export interface ResourceSection {
  type: string;
  /** Raw value strings, the section's own properties only. */
  properties: Record<string, string>;
}

/**
 * The section `path` addresses inside `file`: the `[resource]` body for a plain path, the
 * named `[sub_resource]` for a **Sub-resource path**. Throws for an id `file` does not
 * declare, which fails the address like a missing file (ADR-0046).
 */
export function resourceSection(file: ParsedResource, path: string): ResourceSection {
  const { filePath, subResourceId } = parseSubResourcePath(path);
  if (subResourceId === undefined) return { type: file.resourceType, properties: file.properties };

  const sub = findSubResource(file.subResources, subResourceId);
  if (!sub) throw new Error(`${filePath} declares no sub-resource "${subResourceId}"`);
  // The parser echoes the heading's `id` into `data` for `findSubResource`. Godot
  // stores no such property, so it is not one of the section's.
  const { id: _id, ...properties } = sub.data as Record<string, string>;
  return { type: sub.type, properties };
}

/** {@link resourceSection}, and throws when the section's type is not one of `types`. */
export function resourceSectionOfType(
  file: ParsedResource,
  path: string,
  types: ReadonlySet<string>
): ResourceSection {
  const section = resourceSection(file, path);
  if (!types.has(section.type)) {
    throw new Error(`${path} has type ${section.type}, expected ${oneOf(types)}`);
  }
  return section;
}

/** `Theme`, or `one of FontFile, SystemFont, FontVariation`. */
function oneOf(types: ReadonlySet<string>): string {
  const names = [...types].join(', ');
  return types.size === 1 ? names : `one of ${names}`;
}
