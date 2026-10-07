/**
 * Resolves a resource path to the section it addresses in a parsed `.tres`: the one
 * sub-resource lookup every loader of a path shares, with one error policy. A slice
 * decodes the section it returns.
 */

import type { ParsedResource } from '../parser/parsedResource.js';
import { findSubResource } from './SubResourceResolver.js';
import { parseSubResourcePath } from './subResourcePath.js';

/**
 * The parsed file that owns `path`, a plain path or a **Sub-resource path**, from the
 * `resource` slot's cache. Rejects when the file fails to load or parse.
 */
type ParsedFileLoaderFn = (path: string) => Promise<ParsedResource>;

/** One resource inside a parsed file: its `[resource]` body or one `[sub_resource]`. */
export interface ResourceSection {
  type: string;
  /** Raw value strings, the section's own properties only. */
  properties: Record<string, string>;
}

/** The section `path` addresses inside `file`, or undefined for an id `file` does not declare. */
export function findResourceSection(file: ParsedResource, path: string): ResourceSection | undefined {
  const { subResourceId } = parseSubResourcePath(path);
  if (subResourceId === undefined) return { type: file.resourceType, properties: file.properties };
  const sub = findSubResource(file.subResources, subResourceId);
  return sub && { type: sub.type, properties: sub.data };
}

/**
 * A section and the parsed file that owns it. The file's `ext_resource` and
 * `sub_resource` tables resolve the section's references.
 */
export interface LoadedSection extends ResourceSection {
  file: ParsedResource;
}

/**
 * The section `path` addresses: the `[resource]` body for a plain path, the named
 * `[sub_resource]` for a **Sub-resource path**. Rejects when the owning file fails to
 * load, declares no such id (a failure like a missing file, ADR-0046), or the section's
 * type is not one of `types`.
 */
export type SectionLoaderFn = (path: string, types: ReadonlySet<string>) => Promise<LoadedSection>;

/** The {@link SectionLoaderFn} over the parsed files `loadParsedFile` answers. */
export function sectionLoader(loadParsedFile: ParsedFileLoaderFn): SectionLoaderFn {
  return async (path, types) => {
    const file = await loadParsedFile(path);
    return { file, ...sectionOfType(file, path, types) };
  };
}

function sectionOfType(file: ParsedResource, path: string, types: ReadonlySet<string>): ResourceSection {
  const section = findResourceSection(file, path);
  if (!section) {
    const { filePath, subResourceId } = parseSubResourcePath(path);
    throw new Error(`${filePath} declares no sub-resource "${subResourceId}"`);
  }
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
